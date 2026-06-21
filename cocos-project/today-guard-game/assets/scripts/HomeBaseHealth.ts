import { _decorator, Color, Component, Graphics, Label, Node, UITransform } from 'cc';
import { ArtSpriteHelper } from './ArtSpriteHelper';
import { BgmController } from './BgmController';
import { BattleReportController } from './BattleReportController';
import { FeedbackController } from './FeedbackController';
import { GameState } from './GameState';
import { SaveDataManager } from './SaveDataManager';
import { SfxController } from './SfxController';
import { getExistingComponent, getOrAddComponent } from './ComponentLookup';

const { ccclass, property } = _decorator;

@ccclass('HomeBaseHealth')
export class HomeBaseHealth extends Component {
    @property
    public maxHp = 100;

    @property
    public currentHp = 100;

    @property(Node)
    public gameOverPanel: Node | null = null;

    @property(Label)
    public hpLabel: Label | null = null;

    @property(Node)
    public monsterSpawner: Node | null = null;

    @property(Node)
    public monsterLayer: Node | null = null;

    @property
    public drawPlaceholder = true;

    @property
    public placeholderSize = 64;

    @property(Color)
    public placeholderColor = new Color(90, 180, 120, 255);

    @property
    public baseArtPath = 'art/base/spirit_base';

    @property
    public gameOverBackgroundPath = 'art/ui/gameover_panel_bg';

    private _isGameOver = false;
    private _damageReductionRate = 0;
    private _shieldHp = 0;
    private _lastHpSfxLevel = 100;
    private _baseMaxHp = 100;
    private _runMaxHpPenalty = 0;

    public get isGameOver(): boolean {
        return this._isGameOver;
    }

    public resetHealth(hideGameOverPanel = true): void {
        this._isGameOver = false;
        GameState.reset();
        this.resetRunMaxHpPenalty();
        this.applyPersistentUpgrades(true);
        this.currentHp = this.maxHp;
        this.resetDamageReduction();
        this.resetShield();
        this._lastHpSfxLevel = 100;

        if (hideGameOverPanel && this.gameOverPanel) {
            this.gameOverPanel.active = false;
        }

        this.updateHpLabel();
    }

    protected onLoad(): void {
        this._baseMaxHp = Math.max(1, Math.floor(this.maxHp));
        const shouldFillToMax = this.currentHp >= this._baseMaxHp;
        this.applyPersistentUpgrades(shouldFillToMax);
        this.currentHp = this.clampHp(this.currentHp > 0 ? this.currentHp : this.maxHp);

        if (this.gameOverPanel) {
            this.gameOverPanel.active = false;
        }

        if (this.drawPlaceholder) {
            this.drawHomeBasePlaceholder();
        }

        this.updateHpLabel();
    }

    public takeDamage(damage: number): void {
        if (this._isGameOver || damage <= 0) {
            return;
        }

        const previousHp = this.currentHp;
        let finalDamage = this.getReducedDamage(damage);
        finalDamage = this.consumeShield(finalDamage);
        this.currentHp = this.clampHp(this.currentHp - finalDamage);
        this.updateHpLabel();

        if (this.currentHp < previousHp) {
            FeedbackController.getForNode(this.node)?.playHurtFeedback(this.node);
            SfxController.playSfx(this.node, 'hurt');
            this.playHpStateSfx();
        }

        if (this.currentHp <= 0) {
            this.showGameOver();
        }
    }

    public heal(amount: number): void {
        if (this._isGameOver || amount <= 0) {
            return;
        }

        this.currentHp = this.clampHp(this.currentHp + amount);
        this.updateHpLabel();
    }

    public setDamageReduction(rate: number): void {
        this._damageReductionRate = Math.max(0, Math.min(0.5, rate));
    }

    public addDamageReduction(rate: number): void {
        if (rate <= 0) {
            return;
        }

        this._damageReductionRate = Math.min(0.5, this._damageReductionRate + rate);
    }

    public resetDamageReduction(): void {
        this._damageReductionRate = 0;
    }

    public addShield(amount: number): void {
        if (this._isGameOver || amount <= 0) {
            return;
        }

        this._shieldHp = Math.min(40, this._shieldHp + Math.floor(amount));
        this.updateHpLabel();
    }

    public resetShield(): void {
        this._shieldHp = 0;
        this.updateHpLabel();
    }

    public applyRunMaxHpPenalty(amount: number): void {
        if (amount <= 0 || this._isGameOver) {
            return;
        }

        this._runMaxHpPenalty += Math.floor(amount);
        this.applyPersistentUpgrades(false);
    }

    public resetRunMaxHpPenalty(): void {
        this._runMaxHpPenalty = 0;
        this.applyPersistentUpgrades(false);
    }

    private showGameOver(): void {
        if (this._isGameOver) {
            return;
        }

        this._isGameOver = true;
        GameState.isGameOver = true;
        BgmController.playBgm(this.node, 'result');
        SfxController.playSfx(this.node, 'gameover');
        SfxController.playSfx(this.node, 'hp_0');

        if (this.gameOverPanel) {
            this.applyGameOverBackground();
            this.gameOverPanel.active = true;
            this.showFailureBattleReport();
        }

        FeedbackController.getForNode(this.node)?.playGameOverFeedback(this.gameOverPanel ?? this.node);

        if (this.monsterSpawner) {
            this.monsterSpawner.active = false;
        }

        GameState.destroyAllBullets(this.findBulletLayer());
        this.clearExistingMonsters();
    }

    private showFailureBattleReport(): void {
        const panel = this.gameOverPanel;
        if (!panel) {
            return;
        }

        const canvas = this.findAncestorByName(this.node, 'Canvas');
        const battleHud = canvas?.getChildByName('BattleHUD') ?? null;
        const battleStats = this.findComponentWithAnyMethod<Component & { killCount?: number }>(battleHud, ['addKill', 'reset']);
        const waveController = this.findComponentWithAnyMethod<Component & { currentWave?: number; maxWave?: number }>(
            battleHud,
            ['startCurrentWave', 'resetWaves'],
        );
        const restartController = this.findComponentWithMethod(panel, 'restartBattle')
            ?? this.findComponentWithMethod(canvas?.getChildByName('GameOverPanel') ?? null, 'restartBattle')
            ?? null;
        const report = this.getBattleReportController(panel);

        report.show({
            result: 'failure',
            killCount: Math.max(0, Math.floor(battleStats?.killCount ?? 0)),
            currentHp: 0,
            maxHp: this.maxHp,
            currentWave: Math.max(1, Math.floor(waveController?.currentWave ?? 1)),
            maxWave: Math.max(1, Math.floor(waveController?.maxWave ?? 5)),
            restartText: '重开，假装刚才没发生',
            onRestart: () => {
                const restartable = restartController as Component & { restartBattle?: () => void };
                restartable?.restartBattle?.();
            },
        });
    }

    private getBattleReportController(panel: Node): BattleReportController {
        let report = this.findComponentWithAnyMethod<BattleReportController>(panel, ['show']);
        if (!report) {
            report = panel.addComponent(BattleReportController);
        }
        return report;
    }

    private updateHpLabel(): void {
        const shieldText = this._shieldHp > 0 ? ` 护盾 ${this._shieldHp}` : '';
        const text = `精神值 ${this.currentHp}/${this.maxHp}${shieldText}`;

        if (this.hpLabel) {
            this.hpLabel.string = text;
            return;
        }

        console.log(`[HomeBaseHealth] ${text}`);
    }

    private playHpStateSfx(): void {
        const rate = this.maxHp > 0 ? this.currentHp / this.maxHp : 0;
        const level = rate <= 0 ? 0
            : rate <= 0.2 ? 20
            : rate <= 0.4 ? 40
            : rate <= 0.7 ? 70
            : 100;

        if (level === this._lastHpSfxLevel) {
            return;
        }

        this._lastHpSfxLevel = level;
        SfxController.playSfx(this.node, `hp_${level}`);
        if (level <= 40 && level > 0) {
            BgmController.playBgm(this.node, 'pressure');
        }
    }

    private drawHomeBasePlaceholder(): void {
        const transform = getOrAddComponent(this.node, UITransform);
        transform.setContentSize(this.placeholderSize, this.placeholderSize);

        const graphics = getOrAddComponent(this.node, Graphics);
        graphics.clear();
        graphics.fillColor = this.placeholderColor;
        graphics.rect(
            -this.placeholderSize * 0.5,
            -this.placeholderSize * 0.5,
            this.placeholderSize,
            this.placeholderSize,
        );
        graphics.fill();

        if (this.baseArtPath) {
            ArtSpriteHelper.applySprite(this.node, this.baseArtPath, this.placeholderSize * 1.35, this.placeholderSize * 1.35);
        }
    }

    private applyGameOverBackground(): void {
        if (!this.gameOverPanel || !this.gameOverBackgroundPath) {
            return;
        }

        ArtSpriteHelper.applyFullscreenBackground(this.gameOverPanel, 'GameOverBackground', this.gameOverBackgroundPath);
        this.ensureGameOverReadableLayer();
    }

    private ensureGameOverReadableLayer(): void {
        const panel = this.gameOverPanel;
        if (!panel) {
            return;
        }

        let backdrop = panel.getChildByName('GameOverTextBackdrop');
        if (!backdrop) {
            backdrop = new Node('GameOverTextBackdrop');
            backdrop.layer = panel.layer;
            panel.addChild(backdrop);
        }

        backdrop.setPosition(0, 0, 0);
        backdrop.setSiblingIndex(1);
        this.setNodeSize(backdrop, 580, 290);

        const backdropGraphics = getOrAddComponent(backdrop, Graphics);
        backdropGraphics.clear();
        backdropGraphics.fillColor = new Color(12, 16, 24, 215);
        backdropGraphics.roundRect(-290, -145, 580, 290, 18);
        backdropGraphics.fill();

        this.applyReadableLabelStyle(getExistingComponent(this.findDescendantByName(panel, 'GameOverText'), Label), 34, 42);
        this.applyReadableLabelStyle(getExistingComponent(this.findDescendantByName(panel, 'RestartButtonLabel'), Label), 24, 32);
        this.applyReadableLabelStyle(getExistingComponent(this.findDescendantByName(panel, 'Label'), Label), 24, 32);
        this.drawReadableButton(panel.getChildByName('RestartButton'));
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
        label.node.setSiblingIndex((label.node.parent?.children.length ?? 1) - 1);
    }

    private drawReadableButton(buttonNode: Node | null): void {
        if (!buttonNode) {
            return;
        }

        const transform = getExistingComponent(buttonNode, UITransform);
        const width = Math.max(transform?.width ?? 220, 180);
        const height = Math.max(transform?.height ?? 58, 48);
        const graphics = getOrAddComponent(buttonNode, Graphics);
        graphics.clear();
        graphics.fillColor = new Color(82, 132, 255, 245);
        graphics.roundRect(-width * 0.5, -height * 0.5, width, height, 10);
        graphics.fill();
        buttonNode.setSiblingIndex((buttonNode.parent?.children.length ?? 1) - 1);
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

    public applyPersistentUpgrades(fillToMax = false): void {
        const saveData = SaveDataManager.load();
        const deskLevel = Math.max(0, Math.floor(saveData.upgrades.desk ?? 0));
        this.maxHp = Math.max(30, this._baseMaxHp + deskLevel * 10 - this._runMaxHpPenalty);
        if (fillToMax) {
            this.currentHp = this.maxHp;
        } else {
            this.currentHp = this.clampHp(this.currentHp);
        }
        this.updateHpLabel();
    }

    private setNodeSize(node: Node, width: number, height: number): void {
        const transform = getOrAddComponent(node, UITransform);
        transform.setContentSize(width, height);
    }

    private clampHp(value: number): number {
        return Math.max(0, Math.min(this.maxHp, Math.floor(value)));
    }

    private getReducedDamage(damage: number): number {
        const reducedDamage = damage * (1 - this._damageReductionRate);
        return Math.max(0, Math.floor(reducedDamage));
    }

    private consumeShield(damage: number): number {
        if (damage <= 0 || this._shieldHp <= 0) {
            return damage;
        }

        const blocked = Math.min(this._shieldHp, damage);
        this._shieldHp -= blocked;
        return damage - blocked;
    }

    private clearExistingMonsters(): void {
        const layer = this.monsterLayer ?? this.node.parent?.getChildByName('MonsterLayer') ?? null;
        if (!layer) {
            console.warn('[HomeBaseHealth] 未找到 MonsterLayer，Game Over 后无法清空场上怪物。');
            return;
        }

        for (const monster of [...layer.children]) {
            monster.destroy();
        }
    }

    private findBulletLayer(): Node | null {
        const battleLayer = this.node.parent ?? null;
        return battleLayer?.getChildByName('BulletLayer') ?? null;
    }
}
