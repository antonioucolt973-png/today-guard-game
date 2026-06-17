import { _decorator, Component, Label, Node } from 'cc';
import { BgmController } from './BgmController';
import { BasicMonsterSpawner } from './BasicMonsterSpawner';
import { HomeBaseHealth } from './HomeBaseHealth';
import { SkillChoiceView } from './SkillChoiceView';
import { SfxController } from './SfxController';
import { StartGameController } from './StartGameController';
import { VictoryResultController } from './VictoryResultController';
import { WaveIntermissionView } from './WaveIntermissionView';

const { ccclass, property } = _decorator;

@ccclass('WaveController')
export class WaveController extends Component {
    @property(BasicMonsterSpawner)
    public monsterSpawner: BasicMonsterSpawner | null = null;

    @property(Node)
    public monsterLayer: Node | null = null;

    @property(Label)
    public waveLabel: Label | null = null;

    @property(HomeBaseHealth)
    public homeBaseHealth: HomeBaseHealth | null = null;

    @property(WaveIntermissionView)
    public waveIntermissionView: WaveIntermissionView | null = null;

    @property(SkillChoiceView)
    public skillChoiceView: SkillChoiceView | null = null;

    @property(VictoryResultController)
    public victoryResultController: VictoryResultController | null = null;

    @property
    public firstWaveMonsterCount = 5;

    @property
    public secondWaveMonsterCount = 8;

    @property
    public thirdWaveMonsterCount = 13;

    @property
    public fourthWaveMonsterCount = 18;

    @property
    public fifthWaveMonsterCount = 22;

    @property
    public maxWave = 5;

    @property
    public waitForStartPanel = true;

    private _currentWave = 1;
    private _waveComplete = false;
    private _waveStarted = false;
    private _waitingForNextWave = false;

    public get currentWave(): number {
        return this._currentWave;
    }

    protected start(): void {
        this.setupIntermissionHandlers();
        this.waveIntermissionView?.hide();
        this.skillChoiceView?.hide();
        this.victoryResultController?.hide();
        if (this.waitForStartPanel && this.setupStartPanelController()) {
            this.prepareForStartScreen();
            return;
        }
        this.startCurrentWave();
    }

    protected update(): void {
        if (this.homeBaseHealth?.isGameOver) {
            this.waveIntermissionView?.hide();
            this.skillChoiceView?.hide();
            this.victoryResultController?.hide();
            return;
        }

        if (!this._waveStarted || this._waveComplete || this._waitingForNextWave) {
            return;
        }

        if (this.monsterSpawner?.isWaveSpawnComplete && this.isMonsterLayerEmpty()) {
            this.enterIntermission();
        }
    }

    public resetWaves(): void {
        this._currentWave = 1;
        this.setupIntermissionHandlers();
        this.waveIntermissionView?.hide();
        this.skillChoiceView?.hide();
        this.victoryResultController?.hide();
        this.startCurrentWave();
    }

    public prepareForStartScreen(): void {
        this._currentWave = 1;
        this._waveComplete = false;
        this._waveStarted = false;
        this._waitingForNextWave = false;
        this.waveIntermissionView?.hide();
        this.skillChoiceView?.hide();
        this.victoryResultController?.hide();
        this.updateWaveLabel('点击开始');
    }

    public startFirstWaveFromStartScreen(): void {
        if (this._waveStarted || this.homeBaseHealth?.isGameOver) {
            return;
        }

        this._currentWave = 1;
        this.startCurrentWave();
    }

    public startCurrentWave(): void {
        if (!this.monsterSpawner) {
            console.warn('[WaveController] 请绑定 monsterSpawner。');
            this.updateWaveLabel('等待波次配置');
            return;
        }

        this._waveComplete = false;
        this._waveStarted = true;
        this._waitingForNextWave = false;
        this.waveIntermissionView?.hide();
        this.skillChoiceView?.hide();
        this.victoryResultController?.hide();
        this.updateWaveLabel();
        BgmController.playBgm(this.node, 'battle');
        SfxController.playSfx(this.node, this._currentWave >= 4 ? 'wave_start_fast' : 'wave_start');
        this.monsterSpawner.startWave(this.getCurrentWaveMonsterCount(), this._currentWave);
    }

    public startNextWave(): void {
        if (this.homeBaseHealth?.isGameOver || !this._waitingForNextWave || this._currentWave >= this.maxWave) {
            return;
        }

        this._currentWave += 1;
        this.startCurrentWave();
    }

    private enterIntermission(): void {
        this._waveComplete = true;
        this._waitingForNextWave = true;

        if (this._currentWave >= this.maxWave) {
            this._waitingForNextWave = false;
            this.waveIntermissionView?.hide();
            this.skillChoiceView?.hide();
            this.updateWaveLabel('已守住');
            this.getVictoryResultController()?.showVictory();
            return;
        }

        const skillChoiceView = this.getSkillChoiceView();
        if (skillChoiceView) {
            this.waveIntermissionView?.hide();
            skillChoiceView.show(this._currentWave);
            return;
        }

        this.updateWaveLabel('本波已守住');
        this.waveIntermissionView?.show(this._currentWave);
    }

    private setupIntermissionHandlers(): void {
        this.waveIntermissionView?.setNextWaveHandler(() => this.startNextWave());
        this.getSkillChoiceView()?.setChoiceHandler(() => this.startNextWave());
    }

    private getVictoryResultController(): VictoryResultController | null {
        if (this.victoryResultController) {
            return this.victoryResultController;
        }

        const canvas = this.findAncestorByName(this.node, 'Canvas');
        let panel = canvas?.getChildByName('VictoryPanel') ?? null;
        if (!panel && canvas) {
            panel = new Node('VictoryPanel');
            panel.layer = canvas.layer;
            canvas.addChild(panel);
            panel.setPosition(0, 0, 0);
        }

        this.victoryResultController = this.findComponentWithAnyMethod<VictoryResultController>(panel, ['showVictory', 'hide']);
        if (!this.victoryResultController && panel) {
            this.victoryResultController = panel.addComponent(VictoryResultController);
            this.victoryResultController.victoryPanel = panel;
        }
        return this.victoryResultController;
    }

    private getSkillChoiceView(): SkillChoiceView | null {
        if (this.skillChoiceView) {
            return this.skillChoiceView;
        }

        const panel = this.node.getChildByName('WaveIntermissionPanel');
        this.skillChoiceView = this.findComponentWithAnyMethod<SkillChoiceView>(panel, ['show', 'hide']);
        return this.skillChoiceView;
    }

    private getCurrentWaveMonsterCount(): number {
        if (this._currentWave === 1) {
            return this.firstWaveMonsterCount;
        }

        if (this._currentWave === 2) {
            return this.secondWaveMonsterCount;
        }

        if (this._currentWave === 3) {
            return this.thirdWaveMonsterCount;
        }

        if (this._currentWave === 4) {
            return this.fourthWaveMonsterCount;
        }

        if (this._currentWave === 5) {
            return this.fifthWaveMonsterCount;
        }

        return this.secondWaveMonsterCount;
    }

    private setupStartPanelController(): boolean {
        const canvas = this.findAncestorByName(this.node, 'Canvas');
        const startPanel = canvas?.getChildByName('StartPanel') ?? null;
        if (!startPanel || !startPanel.active) {
            return false;
        }

        const existingController = this.findComponentWithAnyMethod<StartGameController>(startPanel, ['initializeFromWaveController']);
        const controller = existingController ?? startPanel.addComponent(StartGameController);
        controller.initializeFromWaveController(this, startPanel);
        return true;
    }

    private isMonsterLayerEmpty(): boolean {
        return !this.monsterLayer || this.monsterLayer.children.length === 0;
    }

    private findAncestorByName(node: Node | null, name: string): Node | null {
        let current: Node | null = node;
        while (current) {
            if (current.name === name) {
                return current;
            }
            current = current.parent;
        }
        return null;
    }

    private findComponentWithAnyMethod<T extends Component>(node: Node | null, methodNames: string[]): T | null {
        if (!node) {
            return null;
        }

        for (const component of node.components) {
            const candidate = component as Component & Record<string, unknown>;
            if (methodNames.some((methodName) => typeof candidate[methodName] === 'function')) {
                return component as T;
            }
        }

        return null;
    }

    private updateWaveLabel(status?: string): void {
        const text = status ? `第 ${this._currentWave} 波：${status}` : `第 ${this._currentWave} 波`;

        if (this.waveLabel) {
            this.waveLabel.string = text;
            return;
        }

        console.log(`[WaveController] ${text}`);
    }
}
