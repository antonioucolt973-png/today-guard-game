import { _decorator, Component, Node } from 'cc';
import { BasicMonsterSpawner } from './BasicMonsterSpawner';
import { HomeBaseHealth } from './HomeBaseHealth';
import { PlayerAutoAttack } from './PlayerAutoAttack';

const { ccclass, property } = _decorator;

export type SkillEffectId =
    | 'drink_water'
    | 'countdown_offwork'
    | 'no_more_blame'
    | 'keyboard_fire'
    | 'slacking_shield'
    | 'reject_overthinking'
    | 'take_it_slow'
    | 'super_efficiency';

export type SkillCategory = 'output' | 'defense' | 'control';

export type SkillChoice = {
    id: SkillEffectId;
    name: string;
    description: string;
    category: SkillCategory;
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
    public healAmount = 25;

    @property
    public attackIntervalMultiplier = 0.9;

    @property
    public damageReductionRate = 0.15;

    @property
    public shieldAmount = 16;

    @property
    public bulletHitBonus = 0;

    @property
    public bulletDamageBonus = 1;

    @property
    public monsterSpeedMultiplier = 0.9;

    @property
    public nextWaveSpawnIntervalMultiplier = 1.25;

    @property
    public burstAttackIntervalMultiplier = 0.7;

    private readonly _skillPool: SkillChoice[] = [
        {
            id: 'drink_water',
            name: '喝口水冷静一下',
            description: '恢复 25 点精神值',
            category: 'defense',
        },
        {
            id: 'countdown_offwork',
            name: '下班倒计时',
            description: '长期小幅提升发射频率',
            category: 'output',
        },
        {
            id: 'no_more_blame',
            name: '今日不接锅',
            description: '小屋受伤降低，可叠加最高 50%',
            category: 'defense',
        },
        {
            id: 'keyboard_fire',
            name: '键盘冒火',
            description: '子弹更疼，厚皮怪更快被打掉',
            category: 'output',
        },
        {
            id: 'slacking_shield',
            name: '摸鱼护盾',
            description: '获得护盾抵消部分伤害',
            category: 'defense',
        },
        {
            id: 'reject_overthinking',
            name: '拒绝内耗',
            description: '后续新怪移动速度降低',
            category: 'control',
        },
        {
            id: 'take_it_slow',
            name: '先缓一缓',
            description: '下一波怪物生成变慢',
            category: 'control',
        },
        {
            id: 'super_efficiency',
            name: '今天效率爆表',
            description: '下一波内明显提升发射频率',
            category: 'output',
        },
    ];

    public getRandomSkillChoices(count: number): SkillChoice[] {
        const pool = [...this._skillPool];
        const result: SkillChoice[] = [];
        const targetCount = Math.max(0, Math.min(count, pool.length));

        if (targetCount >= 3) {
            this.pickOneByCategory(pool, result, 'output');
            this.pickOneByCategory(pool, result, 'defense');
            this.pickOneByCategory(pool, result, 'control');
        }

        while (result.length < targetCount && pool.length > 0) {
            this.pickRandom(pool, result);
        }

        return this.shuffle(result);
    }

    public applySkill(skillId: SkillEffectId): void {
        this.resolveMissingReferences();

        if (skillId === 'drink_water') {
            this.homeBaseHealth?.heal(this.healAmount);
            return;
        }

        if (skillId === 'countdown_offwork') {
            this.playerAutoAttack?.applyAttackIntervalMultiplier(this.attackIntervalMultiplier);
            return;
        }

        if (skillId === 'no_more_blame') {
            this.homeBaseHealth?.addDamageReduction(this.damageReductionRate);
            return;
        }

        if (skillId === 'keyboard_fire') {
            this.playerAutoAttack?.addBulletHitBonus(this.bulletHitBonus);
            this.playerAutoAttack?.addBulletDamageBonus(this.bulletDamageBonus);
            return;
        }

        if (skillId === 'slacking_shield') {
            this.homeBaseHealth?.addShield(this.shieldAmount);
            return;
        }

        if (skillId === 'reject_overthinking') {
            this.monsterSpawner?.applyMonsterSpeedMultiplier(this.monsterSpeedMultiplier);
            return;
        }

        if (skillId === 'take_it_slow') {
            this.monsterSpawner?.applyNextWaveSpawnIntervalMultiplier(this.nextWaveSpawnIntervalMultiplier);
            return;
        }

        if (skillId === 'super_efficiency') {
            this.playerAutoAttack?.applyTemporaryAttackIntervalMultiplier(this.burstAttackIntervalMultiplier);
        }
    }

    public resetEffects(): void {
        this.resolveMissingReferences();
        this.homeBaseHealth?.resetDamageReduction();
        this.homeBaseHealth?.resetShield();
        this.playerAutoAttack?.resetAttackInterval();
        this.playerAutoAttack?.resetBulletHitBonus();
        this.playerAutoAttack?.resetBulletDamageBonus();
        this.monsterSpawner?.resetSkillModifiers();
    }

    public clearTemporaryEffects(): void {
        this.resolveMissingReferences();
        this.playerAutoAttack?.clearTemporaryAttackBoost();
    }

    private pickOneByCategory(pool: SkillChoice[], result: SkillChoice[], category: SkillCategory): void {
        const candidates = pool
            .map((choice, index) => ({ choice, index }))
            .filter((entry) => entry.choice.category === category);
        if (candidates.length <= 0) {
            return;
        }

        const selected = candidates[Math.floor(Math.random() * candidates.length)];
        const [choice] = pool.splice(selected.index, 1);
        if (choice) {
            result.push(choice);
        }
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
