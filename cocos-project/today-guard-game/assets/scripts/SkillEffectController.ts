import { _decorator, Component, Node } from 'cc';
import { BasicMonsterSpawner } from './BasicMonsterSpawner';
import { HomeBaseHealth } from './HomeBaseHealth';
import { PlayerAutoAttack } from './PlayerAutoAttack';
import { SaveDataManager } from './SaveDataManager';
import { SkillRuntimeState, SkillTag } from './SkillRuntimeState';

const { ccclass, property } = _decorator;

export type SkillEffectId =
    | 'keyboard_fire'
    | 'fast_hands'
    | 'slacking_heal'
    | 'overtime_shield'
    | 'meeting_pause'
    | 'process_stuck'
    | 'risky_overtime'
    | 'boss_promise';

export type SkillTiming = 'instant' | 'nextWave' | 'passive';

export type SkillChoice = {
    id: SkillEffectId;
    name: string;
    description: string;
    tag: SkillTag;
    timing: SkillTiming;
    maxStacks: number;
    allowConsecutive: boolean;
};

@ccclass('SkillEffectController')
export class SkillEffectController extends Component {
    @property(HomeBaseHealth)
    public homeBaseHealth: HomeBaseHealth | null = null;

    @property(PlayerAutoAttack)
    public playerAutoAttack: PlayerAutoAttack | null = null;

    @property(BasicMonsterSpawner)
    public monsterSpawner: BasicMonsterSpawner | null = null;

    @property
    public healAmount = 18;

    @property
    public attackIntervalMultiplier = 0.94;

    @property
    public shieldAmount = 20;

    @property
    public bulletDamageBonus = 1;

    @property
    public nextWaveMonsterSpeedMultiplier = 0.82;

    @property
    public meetingFreezeSeconds = 3;

    @property
    public greedCoinBonusRate = 0.25;

    @property
    public greedMonsterSpeedPenalty = 0.15;

    @property
    public bossPromiseCoins = 25;

    @property
    public bossPromiseMaxHpPenalty = 15;

    private _lastAppliedSkillId: SkillEffectId | null = null;
    private readonly _skillStacks = new Map<SkillEffectId, number>();

    private readonly _skillPool: SkillChoice[] = [
        {
            id: 'keyboard_fire',
            name: '键盘冒火',
            description: '本局子弹伤害 +1',
            tag: 'keyboard',
            timing: 'passive',
            maxStacks: 12,
            allowConsecutive: true,
        },
        {
            id: 'fast_hands',
            name: '手速上线',
            description: '本局攻击间隔缩短',
            tag: 'keyboard',
            timing: 'passive',
            maxStacks: 10,
            allowConsecutive: true,
        },
        {
            id: 'slacking_heal',
            name: '摸鱼回血',
            description: '立刻恢复精神值',
            tag: 'survival',
            timing: 'instant',
            maxStacks: 99,
            allowConsecutive: true,
        },
        {
            id: 'overtime_shield',
            name: '加班护盾',
            description: '下一波开始获得护盾',
            tag: 'survival',
            timing: 'nextWave',
            maxStacks: 99,
            allowConsecutive: true,
        },
        {
            id: 'meeting_pause',
            name: '主管开会',
            description: '下一波前 3 秒，怪物生成但不移动',
            tag: 'survival',
            timing: 'nextWave',
            maxStacks: 99,
            allowConsecutive: false,
        },
        {
            id: 'process_stuck',
            name: '流程卡住',
            description: '下一波怪物速度降低',
            tag: 'control',
            timing: 'nextWave',
            maxStacks: 99,
            allowConsecutive: true,
        },
        {
            id: 'risky_overtime',
            name: '今天想不开',
            description: '摸鱼币增加，但怪物更快',
            tag: 'greed',
            timing: 'passive',
            maxStacks: 6,
            allowConsecutive: true,
        },
        {
            id: 'boss_promise',
            name: '老板画饼',
            description: '立刻得摸鱼币，本局精神上限降低',
            tag: 'greed',
            timing: 'instant',
            maxStacks: 3,
            allowConsecutive: true,
        },
    ];
    public getRandomSkillChoices(count: number): SkillChoice[] {
        const pool = this._skillPool.filter((choice) => this.canOfferSkill(choice));
        const result: SkillChoice[] = [];
        const targetCount = Math.max(0, Math.min(count, pool.length));

        if (targetCount >= 3) {
            this.pickOneByTag(pool, result, ['keyboard', 'control']);
            this.pickOneByTag(pool, result, ['survival']);
            this.pickOneByTag(pool, result, ['greed', 'keyboard', 'control', 'survival']);
        }

        while (result.length < targetCount && pool.length > 0) {
            this.pickRandom(pool, result);
        }

        return this.shuffle(result.map((choice) => this.withBalancedDescription(choice)));
    }

    public applySkill(skillId: SkillEffectId): void {
        this.resolveMissingReferences();
        const skill = this._skillPool.find((choice) => choice.id === skillId);
        if (!skill || !this.canApplySkill(skill)) {
            return;
        }

        if (skillId === 'keyboard_fire') {
            const stackBefore = this.getSkillStackCount(skillId);
            const damageBonus = this.getKeyboardDamageBonus(stackBefore);
            const hitBonus = this.getKeyboardHitBonus(stackBefore);
            if (damageBonus > 0) {
                this.playerAutoAttack?.addBulletDamageBonus(damageBonus);
            }
            if (hitBonus > 0) {
                this.playerAutoAttack?.addBulletHitBonus(hitBonus);
            }
        }

        if (skillId === 'fast_hands') {
            this.playerAutoAttack?.applyAttackIntervalMultiplier(this.getFastHandsMultiplier(this.getSkillStackCount(skillId)));
        }

        if (skillId === 'slacking_heal') {
            this.homeBaseHealth?.heal(this.healAmount);
        }

        if (skillId === 'overtime_shield') {
            SkillRuntimeState.nextWaveShield = Math.min(40, SkillRuntimeState.nextWaveShield + this.getOvertimeShieldAmount());
        }

        if (skillId === 'meeting_pause') {
            SkillRuntimeState.nextWaveFreezeSeconds = Math.max(SkillRuntimeState.nextWaveFreezeSeconds, this.meetingFreezeSeconds);
        }

        if (skillId === 'process_stuck') {
            SkillRuntimeState.nextWaveMonsterSpeedMultiplier = Math.max(0.7, SkillRuntimeState.nextWaveMonsterSpeedMultiplier * this.nextWaveMonsterSpeedMultiplier);
        }

        if (skillId === 'risky_overtime') {
            SkillRuntimeState.coinBonusRate = Math.min(0.6, SkillRuntimeState.coinBonusRate + this.greedCoinBonusRate);
            SkillRuntimeState.monsterSpeedPenaltyRate = Math.min(0.6, SkillRuntimeState.monsterSpeedPenaltyRate + this.greedMonsterSpeedPenalty);
            this.monsterSpawner?.applyMonsterSpeedMultiplier(1 + this.greedMonsterSpeedPenalty);
        }

        if (skillId === 'boss_promise') {
            SaveDataManager.addCoins(this.bossPromiseCoins);
            SkillRuntimeState.maxHpPenalty += this.bossPromiseMaxHpPenalty;
            this.homeBaseHealth?.applyRunMaxHpPenalty(this.bossPromiseMaxHpPenalty);
        }

        this.recordSkill(skill);
    }

    public applyNextWaveStartEffects(): void {
        this.resolveMissingReferences();
        const shield = SkillRuntimeState.consumeNextWaveShield();
        if (shield > 0) {
            this.homeBaseHealth?.addShield(shield);
        }

        const speedMultiplier = SkillRuntimeState.consumeNextWaveMonsterSpeedMultiplier();
        if (speedMultiplier !== 1) {
            this.monsterSpawner?.applyNextWaveMonsterSpeedMultiplier(speedMultiplier);
        }

        const freezeSeconds = SkillRuntimeState.consumeNextWaveFreezeSeconds();
        if (freezeSeconds > 0) {
            this.monsterSpawner?.applyNextWaveOpeningFreeze(freezeSeconds);
        }
    }

    public resetEffects(): void {
        this.resolveMissingReferences();
        SkillRuntimeState.resetRun();
        this._lastAppliedSkillId = null;
        this._skillStacks.clear();
        this.homeBaseHealth?.resetDamageReduction();
        this.homeBaseHealth?.resetShield();
        this.homeBaseHealth?.resetRunMaxHpPenalty();
        this.playerAutoAttack?.resetAttackInterval();
        this.playerAutoAttack?.resetBulletHitBonus();
        this.playerAutoAttack?.resetBulletDamageBonus();
        this.monsterSpawner?.resetSkillModifiers();
    }

    public clearTemporaryEffects(): void {
        this.resolveMissingReferences();
        this.playerAutoAttack?.clearTemporaryAttackBoost();
    }

    public clearWaveOnlyEffects(): void {
        this.resolveMissingReferences();
        this.homeBaseHealth?.resetShield();
    }

    private pickOneByTag(pool: SkillChoice[], result: SkillChoice[], tags: SkillTag[]): void {
        const candidates = pool
            .map((choice, index) => ({ choice, index }))
            .filter((entry) => tags.includes(entry.choice.tag));
        if (candidates.length <= 0) {
            return;
        }

        const selected = candidates[Math.floor(Math.random() * candidates.length)];
        const [choice] = pool.splice(selected.index, 1);
        if (choice) {
            result.push(choice);
        }
    }

    private canOfferSkill(choice: SkillChoice): boolean {
        if (!choice.allowConsecutive && this._lastAppliedSkillId === choice.id) {
            return false;
        }

        if (!this.isPendingNextWaveSkillAvailable(choice.id)) {
            return false;
        }

        return this.getSkillStackCount(choice.id) < choice.maxStacks;
    }

    private canApplySkill(choice: SkillChoice): boolean {
        return this.isPendingNextWaveSkillAvailable(choice.id) && this.getSkillStackCount(choice.id) < choice.maxStacks;
    }

    private recordSkill(choice: SkillChoice): void {
        this._lastAppliedSkillId = choice.id;
        this._skillStacks.set(choice.id, this.getSkillStackCount(choice.id) + 1);
        const triggeredSynergy = SkillRuntimeState.addTag(choice.tag);
        if (!triggeredSynergy) {
            return;
        }

        if (choice.tag === 'keyboard') {
            this.playerAutoAttack?.addBulletHitBonus(6);
            return;
        }

        if (choice.tag === 'survival') {
            this.homeBaseHealth?.heal(5);
            return;
        }

        if (choice.tag === 'control') {
            SkillRuntimeState.nextWaveMonsterSpeedMultiplier = Math.max(0.7, SkillRuntimeState.nextWaveMonsterSpeedMultiplier * 0.95);
            return;
        }

        SkillRuntimeState.coinBonusRate = Math.min(0.6, SkillRuntimeState.coinBonusRate + 0.1);
        SkillRuntimeState.monsterSpeedPenaltyRate = Math.min(0.6, SkillRuntimeState.monsterSpeedPenaltyRate + 0.08);
        this.monsterSpawner?.applyMonsterSpeedMultiplier(1.08);
    }

    private getSkillStackCount(skillId: SkillEffectId): number {
        return this._skillStacks.get(skillId) ?? 0;
    }

    private getOvertimeShieldAmount(): number {
        return Math.max(20, Math.floor(this.shieldAmount));
    }

    private getKeyboardDamageBonus(stackBefore: number): number {
        if (stackBefore < 3) {
            return this.bulletDamageBonus;
        }

        return stackBefore === 6 || stackBefore === 10 ? this.bulletDamageBonus : 0;
    }

    private getKeyboardHitBonus(stackBefore: number): number {
        if (stackBefore < 3) {
            return 0;
        }

        return stackBefore < 8 ? 4 : 2;
    }

    private getFastHandsMultiplier(stackBefore: number): number {
        if (stackBefore < 3) {
            return this.attackIntervalMultiplier;
        }

        if (stackBefore < 6) {
            return 0.97;
        }

        return 0.985;
    }

    private isPendingNextWaveSkillAvailable(skillId: SkillEffectId): boolean {
        if (skillId === 'overtime_shield') {
            return SkillRuntimeState.nextWaveShield < 40;
        }

        if (skillId === 'meeting_pause') {
            return SkillRuntimeState.nextWaveFreezeSeconds <= 0;
        }

        if (skillId === 'process_stuck') {
            return SkillRuntimeState.nextWaveMonsterSpeedMultiplier > 0.75;
        }

        return true;
    }

    private pickRandom(pool: SkillChoice[], result: SkillChoice[]): void {
        const index = Math.floor(Math.random() * pool.length);
        const [choice] = pool.splice(index, 1);
        if (choice) {
            result.push(choice);
        }
    }

    private shuffle(choices: SkillChoice[]): SkillChoice[] {
        const result = [...choices];
        for (let index = result.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(Math.random() * (index + 1));
            const current = result[index];
            result[index] = result[swapIndex];
            result[swapIndex] = current;
        }
        return result;
    }

    private withBalancedDescription(choice: SkillChoice): SkillChoice {
        return {
            ...choice,
            description: this.getBalancedDescription(choice),
        };
    }

    private getBalancedDescription(choice: SkillChoice): string {
        const skillId = choice.id;
        const currentStack = this.getSkillStackCount(skillId);
        const nextLevel = currentStack + 1;

        if (skillId === 'keyboard_fire') {
            if (currentStack < 3) {
                return `Lv.${nextLevel}/${choice.maxStacks}：子弹伤害 +1`;
            }

            if (currentStack === 6 || currentStack === 10) {
                return `Lv.${nextLevel}/${choice.maxStacks}：子弹伤害 +1，命中容错小幅提升`;
            }

            return `Lv.${nextLevel}/${choice.maxStacks}：命中容错提升，后期收益递减`;
        }

        if (skillId === 'fast_hands') {
            if (currentStack < 3) {
                return `Lv.${nextLevel}/${choice.maxStacks}：攻击间隔再缩短 6%`;
            }

            if (currentStack < 6) {
                return `Lv.${nextLevel}/${choice.maxStacks}：攻击间隔再缩短 3%`;
            }

            return `Lv.${nextLevel}/${choice.maxStacks}：攻击间隔再缩短 1.5%（高等级递减）`;
        }

        if (skillId === 'slacking_heal') {
            return '立刻恢复 18 精神值';
        }

        if (skillId === 'overtime_shield') {
            return '下一波开始获得 20 护盾，波结束清空';
        }

        if (skillId === 'meeting_pause') {
            return '下一波前 3 秒，怪物生成但不移动';
        }

        if (skillId === 'process_stuck') {
            return '下一波怪物速度 -18%';
        }

        if (skillId === 'risky_overtime') {
            return `Lv.${nextLevel}/${choice.maxStacks}：摸鱼币 +25%，怪物速度 +15%`;
        }

        return `Lv.${nextLevel}/${choice.maxStacks}：立刻获得 25 摸鱼币，本局精神上限 -15`;
    }
    private resolveMissingReferences(): void {
        if (this.homeBaseHealth && this.playerAutoAttack && this.monsterSpawner) {
            return;
        }

        const canvas = this.findAncestorByName(this.node, 'Canvas');
        const battleLayer = canvas?.getChildByName('BattleLayer') ?? null;
        const homeBase = battleLayer?.getChildByName('HomeBase') ?? null;
        const player = battleLayer?.getChildByName('Player') ?? null;
        const monsterSpawner = battleLayer?.getChildByName('MonsterSpawner') ?? null;

        this.homeBaseHealth = this.homeBaseHealth ?? this.findComponentWithAnyMethod<HomeBaseHealth>(homeBase, ['heal', 'resetDamageReduction']) ?? null;
        this.playerAutoAttack = this.playerAutoAttack ?? this.findComponentWithAnyMethod<PlayerAutoAttack>(player, ['applyAttackIntervalMultiplier', 'resetAttackInterval']) ?? null;
        this.monsterSpawner = this.monsterSpawner ?? this.findComponentWithAnyMethod<BasicMonsterSpawner>(monsterSpawner, ['applyMonsterSpeedMultiplier', 'resetSkillModifiers']) ?? null;
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
