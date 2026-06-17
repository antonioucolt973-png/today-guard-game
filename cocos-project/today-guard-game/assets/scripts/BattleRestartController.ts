import { _decorator, Button, Component, Node } from 'cc';
import { BattleStats } from './BattleStats';
import { BasicMonsterSpawner } from './BasicMonsterSpawner';
import { FeedbackController } from './FeedbackController';
import { HomeBaseHealth } from './HomeBaseHealth';
import { PlayerAutoAttack } from './PlayerAutoAttack';
import { SkillChoiceView } from './SkillChoiceView';
import { SkillEffectController } from './SkillEffectController';
import { VictoryResultController } from './VictoryResultController';
import { WaveController } from './WaveController';

const { ccclass, property } = _decorator;

@ccclass('BattleRestartController')
export class BattleRestartController extends Component {
    @property(HomeBaseHealth)
    public homeBaseHealth: HomeBaseHealth | null = null;

    @property(BasicMonsterSpawner)
    public monsterSpawner: BasicMonsterSpawner | null = null;

    @property(PlayerAutoAttack)
    public playerAutoAttack: PlayerAutoAttack | null = null;

    @property(BattleStats)
    public battleStats: BattleStats | null = null;

    @property(WaveController)
    public waveController: WaveController | null = null;

    @property(SkillEffectController)
    public skillEffectController: SkillEffectController | null = null;

    @property(SkillChoiceView)
    public skillChoiceView: SkillChoiceView | null = null;

    @property(VictoryResultController)
    public victoryResultController: VictoryResultController | null = null;

    @property(Node)
    public monsterLayer: Node | null = null;

    @property(Node)
    public bulletLayer: Node | null = null;

    @property(Node)
    public gameOverPanel: Node | null = null;

    @property(Button)
    public restartButton: Button | null = null;

    protected onEnable(): void {
        this.restartButton?.node.on(Button.EventType.CLICK, this.restartBattle, this);
    }

    protected onDisable(): void {
        this.restartButton?.node.off(Button.EventType.CLICK, this.restartBattle, this);
    }

    public restartBattle(): void {
        this.resolveMissingReferences();
        FeedbackController.getForNode(this.node)?.playClickFeedback(this.restartButton?.node ?? this.node);

        this.clearLayer(this.monsterLayer);
        this.clearLayer(this.bulletLayer);
        this.skillChoiceView?.hide();
        this.victoryResultController?.hide();
        this.battleStats?.reset();
        this.skillEffectController?.resetEffects();
        this.homeBaseHealth?.resetHealth(false);
        if (this.waveController) {
            this.waveController.resetWaves();
        } else {
            this.monsterSpawner?.restartSpawning();
        }
        this.playerAutoAttack?.resetAttack();

        if (this.gameOverPanel) {
            this.gameOverPanel.active = false;
        }
    }

    private clearLayer(layer: Node | null): void {
        if (!layer) {
            return;
        }

        for (const child of [...layer.children]) {
            child.destroy();
        }
    }

    private resolveMissingReferences(): void {
        const canvas = this.findAncestorByName(this.node, 'Canvas');
        const battleLayer = canvas?.getChildByName('BattleLayer') ?? null;
        const battleHud = canvas?.getChildByName('BattleHUD') ?? null;

        const homeBase = battleLayer?.getChildByName('HomeBase') ?? null;
        const player = battleLayer?.getChildByName('Player') ?? null;
        const monsterSpawnerNode = battleLayer?.getChildByName('MonsterSpawner') ?? null;
        const waveIntermissionPanel = battleHud?.getChildByName('WaveIntermissionPanel') ?? null;
        const victoryPanel = canvas?.getChildByName('VictoryPanel') ?? null;

        this.monsterLayer = this.monsterLayer ?? battleLayer?.getChildByName('MonsterLayer') ?? null;
        this.bulletLayer = this.bulletLayer ?? battleLayer?.getChildByName('BulletLayer') ?? null;
        this.gameOverPanel = this.gameOverPanel ?? canvas?.getChildByName('GameOverPanel') ?? this.node;

        this.homeBaseHealth = this.homeBaseHealth ?? this.findComponentWithAnyMethod<HomeBaseHealth>(homeBase, ['resetHealth', 'takeDamage']) ?? null;
        this.monsterSpawner = this.monsterSpawner ?? this.findComponentWithAnyMethod<BasicMonsterSpawner>(monsterSpawnerNode, ['startWave', 'restartSpawning']) ?? null;
        this.playerAutoAttack = this.playerAutoAttack ?? this.findComponentWithAnyMethod<PlayerAutoAttack>(player, ['resetAttack', 'applyAttackIntervalMultiplier']) ?? null;
        this.battleStats = this.battleStats ?? this.findComponentWithAnyMethod<BattleStats>(battleHud, ['reset', 'addKill']) ?? null;
        this.waveController = this.waveController ?? this.findComponentWithAnyMethod<WaveController>(battleHud, ['resetWaves', 'startCurrentWave']) ?? null;
        this.skillEffectController = this.skillEffectController ?? this.findComponentWithAnyMethod<SkillEffectController>(waveIntermissionPanel, ['resetEffects', 'applySkill']) ?? null;
        this.skillChoiceView = this.skillChoiceView ?? this.findComponentWithAnyMethod<SkillChoiceView>(waveIntermissionPanel, ['hide', 'show']) ?? null;
        this.victoryResultController = this.victoryResultController
            ?? this.findComponentWithAnyMethod<VictoryResultController>(victoryPanel, ['hide', 'showVictory'])
            ?? this.waveController?.victoryResultController
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
}
