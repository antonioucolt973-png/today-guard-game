import { _decorator, Button, Color, Component, Graphics, Label, Node, UITransform } from 'cc';
import { ArtSpriteHelper } from './ArtSpriteHelper';
import { BattleReportController } from './BattleReportController';
import { BattleStats } from './BattleStats';
import { BgmController } from './BgmController';
import { FeedbackController } from './FeedbackController';
import { HomeBaseHealth } from './HomeBaseHealth';
import { SfxController } from './SfxController';
import { getExistingComponent, getOrAddComponent } from './ComponentLookup';

const { ccclass, property } = _decorator;

type RestartControllerLike = Component & {
    restartBattle?: () => void;
};

@ccclass('VictoryResultController')
export class VictoryResultController extends Component {
    @property(Node)
    public victoryPanel: Node | null = null;

    @property(Label)
    public titleLabel: Label | null = null;

    @property(Label)
    public statsLabel: Label | null = null;

    @property(Button)
    public restartButton: Button | null = null;

    public battleRestartController: Component | null = null;

    @property(HomeBaseHealth)
    public homeBaseHealth: HomeBaseHealth | null = null;

    @property(BattleStats)
    public battleStats: BattleStats | null = null;

    @property
    public backgroundPath = 'art/ui/victory_panel_bg';

    private _restartListening = false;

    protected onLoad(): void {
        this.hide();
    }

    protected onEnable(): void {
        this.ensureRestartListener();
    }

    protected onDisable(): void {
        if (this.restartButton && this._restartListening) {
            this.restartButton.node.off(Button.EventType.CLICK, this.handleRestartClicked, this);
            this._restartListening = false;
        }
    }

    public showVictory(): void {
        this.resolveMissingReferences();
        this.ensureDefaultView();
        this.ensureRestartListener();
        this.refreshReadableStyles();

        if (this.titleLabel) {
            this.titleLabel.string = '今天守住了';
        }

        if (this.statsLabel) {
            const killCount = this.battleStats?.killCount ?? 0;
            const currentHp = this.homeBaseHealth?.currentHp ?? 0;
            const maxHp = this.homeBaseHealth?.maxHp ?? 100;
            this.statsLabel.string = `击退 ${killCount} 个情绪怪\n剩余精神值 ${currentHp}/${maxHp}`;
        }

        const panel = this.getPanel();
        if (panel) {
            panel.active = true;
            this.showBattleReport(panel);
            BgmController.playBgm(this.node, 'result');
            SfxController.playSfx(this.node, 'win');
            FeedbackController.getForNode(this.node)?.playVictoryFeedback(panel);
        }
    }

    public hide(): void {
        const panel = this.getPanel();
        if (panel) {
            panel.active = false;
        }
    }

    private handleRestartClicked(): void {
        this.hide();
        (this.battleRestartController as RestartControllerLike | null)?.restartBattle?.();
    }

    private showBattleReport(panel: Node): void {
        const killCount = this.battleStats?.killCount ?? 0;
        const currentHp = this.homeBaseHealth?.currentHp ?? 0;
        const maxHp = this.homeBaseHealth?.maxHp ?? 100;
        const waveInfo = this.getWaveInfo();
        const report = this.getBattleReportController(panel);
        report.show({
            result: 'victory',
            killCount,
            currentHp,
            maxHp,
            currentWave: waveInfo.currentWave,
            maxWave: waveInfo.maxWave,
            restartText: '再守一天',
            onRestart: () => this.handleRestartClicked(),
        });
    }

    private getBattleReportController(panel: Node): BattleReportController {
        let report = this.findComponentWithAnyMethod<BattleReportController>(panel, ['show']);
        if (!report) {
            report = panel.addComponent(BattleReportController);
        }
        return report;
    }

    private getWaveInfo(): { currentWave: number; maxWave: number } {
        const canvas = this.findAncestorByName(this.node, 'Canvas');
        const battleHud = canvas?.getChildByName('BattleHUD') ?? null;
        const waveController = this.findComponentWithAnyMethod<Component & { currentWave?: number; maxWave?: number }>(
            battleHud,
            ['startCurrentWave', 'resetWaves'],
        );
        const maxWave = Math.max(1, Math.floor(waveController?.maxWave ?? 5));
        const currentWave = Math.max(1, Math.floor(waveController?.currentWave ?? maxWave));
        return { currentWave, maxWave };
    }

    private getPanel(): Node | null {
        return this.victoryPanel ?? this.node;
    }

    private ensureDefaultView(): void {
        const panel = this.getPanel();
        if (!panel) {
            return;
        }

        this.victoryPanel = panel;
        const panelSize = ArtSpriteHelper.getReferenceSize(panel);
        this.setNodeSize(panel, panelSize.width, panelSize.height);
        this.drawPanelBackground(panel);
        this.ensureReadableBackdrop(panel);

        if (!this.titleLabel) {
            this.titleLabel = this.createLabel(panel, 'VictoryTitleLabel', 0, 82, 480, 44, 30, 36);
        }

        if (!this.statsLabel) {
            this.statsLabel = this.createLabel(panel, 'VictoryStatsLabel', 0, 8, 480, 72, 22, 30);
        }

        if (!this.restartButton) {
            const buttonNode = new Node('RestartButton');
            buttonNode.layer = panel.layer;
            panel.addChild(buttonNode);
            buttonNode.setPosition(0, -98, 0);
            this.setNodeSize(buttonNode, 220, 58);

            this.restartButton = buttonNode.addComponent(Button);
            const buttonGraphics = buttonNode.addComponent(Graphics);
            buttonGraphics.fillColor = new Color(80, 170, 120, 255);
            buttonGraphics.roundRect(-110, -29, 220, 58, 10);
            buttonGraphics.fill();

            const labelNode = new Node('Label');
            labelNode.layer = panel.layer;
            buttonNode.addChild(labelNode);
            labelNode.setPosition(0, 0, 0);
            const label = labelNode.addComponent(Label);
            label.string = '重新开始';
            this.setLabelLayout(label, 200, 40, 22, 28);
        }
    }

    private createLabel(
        parent: Node,
        name: string,
        x: number,
        y: number,
        width: number,
        height: number,
        fontSize: number,
        lineHeight: number,
    ): Label {
        const node = new Node(name);
        node.layer = parent.layer;
        parent.addChild(node);
        node.setPosition(x, y, 0);
        const label = node.addComponent(Label);
        this.setLabelLayout(label, width, height, fontSize, lineHeight);
        return label;
    }

    private setLabelLayout(label: Label, width: number, height: number, fontSize: number, lineHeight: number): void {
        this.setNodeSize(label.node, width, height);
        label.fontSize = fontSize;
        label.lineHeight = lineHeight;
        label.color = new Color(255, 248, 224, 255);
        label.horizontalAlign = 1;
        label.verticalAlign = 1;
    }

    private setNodeSize(node: Node, width: number, height: number): void {
        const transform = getOrAddComponent(node, UITransform);
        transform.setContentSize(width, height);
    }

    private drawPanelBackground(panel: Node): void {
        const transform = getExistingComponent(panel, UITransform);
        const width = transform?.width ?? 1280;
        const height = transform?.height ?? 720;
        const graphics = getOrAddComponent(panel, Graphics);
        graphics.clear();
        graphics.fillColor = new Color(18, 22, 32, 180);
        graphics.rect(-width * 0.5, -height * 0.5, width, height);
        graphics.fill();
        graphics.fillColor = new Color(36, 42, 54, 230);
        graphics.roundRect(-260, -150, 520, 300, 12);
        graphics.fill();

        if (this.backgroundPath) {
            ArtSpriteHelper.applyFullscreenBackground(panel, 'VictoryBackground', this.backgroundPath);
        }
    }

    private ensureReadableBackdrop(panel: Node): void {
        let backdrop = panel.getChildByName('VictoryTextBackdrop');
        if (!backdrop) {
            backdrop = new Node('VictoryTextBackdrop');
            backdrop.layer = panel.layer;
            panel.addChild(backdrop);
        }

        backdrop.setPosition(0, 0, 0);
        backdrop.setSiblingIndex(1);
        this.setNodeSize(backdrop, 560, 330);

        const graphics = getOrAddComponent(backdrop, Graphics);
        graphics.clear();
        graphics.fillColor = new Color(12, 16, 24, 210);
        graphics.roundRect(-280, -165, 560, 330, 18);
        graphics.fill();
    }

    private refreshReadableStyles(): void {
        if (this.titleLabel) {
            this.setLabelLayout(this.titleLabel, 480, 44, 30, 38);
            this.titleLabel.node.setSiblingIndex((this.titleLabel.node.parent?.children.length ?? 1) - 1);
        }

        if (this.statsLabel) {
            this.setLabelLayout(this.statsLabel, 480, 72, 22, 30);
            this.statsLabel.node.setSiblingIndex((this.statsLabel.node.parent?.children.length ?? 1) - 1);
        }

        if (this.restartButton) {
            this.drawReadableButton(this.restartButton.node);
            this.applyReadableLabelStyle(getExistingComponent(this.findDescendantByName(this.restartButton.node, 'Label'), Label), 22, 28);
            this.applyReadableLabelStyle(getExistingComponent(this.findDescendantByName(this.restartButton.node, 'RestartButtonLabel'), Label), 22, 28);
            this.restartButton.node.setSiblingIndex((this.restartButton.node.parent?.children.length ?? 1) - 1);
        }
    }

    private applyReadableLabelStyle(label: Label | null, fontSize: number, lineHeight: number): void {
        if (!label) {
            return;
        }

        label.fontSize = fontSize;
        label.lineHeight = lineHeight;
        label.color = new Color(255, 248, 224, 255);
        label.horizontalAlign = 1;
        label.verticalAlign = 1;
    }

    private drawReadableButton(buttonNode: Node): void {
        const transform = getExistingComponent(buttonNode, UITransform);
        const width = Math.max(transform?.width ?? 220, 180);
        const height = Math.max(transform?.height ?? 58, 48);
        const graphics = getOrAddComponent(buttonNode, Graphics);
        graphics.clear();
        graphics.fillColor = new Color(80, 170, 120, 255);
        graphics.roundRect(-width * 0.5, -height * 0.5, width, height, 10);
        graphics.fill();
    }

    private ensureRestartListener(): void {
        if (!this.restartButton || this._restartListening) {
            return;
        }

        this.restartButton.node.on(Button.EventType.CLICK, this.handleRestartClicked, this);
        this._restartListening = true;
    }

    private resolveMissingReferences(): void {
        const canvas = this.findAncestorByName(this.node, 'Canvas');
        const battleLayer = canvas?.getChildByName('BattleLayer') ?? null;
        const battleHud = canvas?.getChildByName('BattleHUD') ?? null;
        const homeBase = battleLayer?.getChildByName('HomeBase') ?? null;

        this.homeBaseHealth = this.homeBaseHealth ?? this.findComponentWithAnyMethod<HomeBaseHealth>(homeBase, ['resetHealth', 'takeDamage']) ?? null;
        this.battleStats = this.battleStats ?? this.findComponentWithAnyMethod<BattleStats>(battleHud, ['reset', 'addKill']) ?? null;
        this.battleRestartController = this.battleRestartController
            ?? this.findComponentWithMethod(canvas?.getChildByName('GameOverPanel') ?? null, 'restartBattle')
            ?? this.findComponentWithMethod(this.node, 'restartBattle')
            ?? null;
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

    private findComponentWithMethod(node: Node | null, methodName: string): Component | null {
        if (!node) {
            return null;
        }

        for (const component of node.components) {
            const candidate = component as Component & Record<string, unknown>;
            if (typeof candidate[methodName] === 'function') {
                return component;
            }
        }

        return null;
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

    private findDescendantByName(node: Node, name: string): Node | null {
        if (node.name === name) {
            return node;
        }

        for (const child of node.children) {
            const found = this.findDescendantByName(child, name);
            if (found) {
                return found;
            }
        }

        return null;
    }
}
