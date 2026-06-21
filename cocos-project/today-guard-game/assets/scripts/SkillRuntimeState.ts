export type SkillTag = 'keyboard' | 'survival' | 'control' | 'greed';

export class SkillRuntimeState {
    public static keyboardCount = 0;
    public static survivalCount = 0;
    public static controlCount = 0;
    public static greedCount = 0;

    public static coinBonusRate = 0;
    public static monsterSpeedPenaltyRate = 0;
    public static nextWaveShield = 0;
    public static nextWaveMonsterSpeedMultiplier = 1;
    public static nextWaveFreezeSeconds = 0;
    public static maxHpPenalty = 0;

    private static readonly triggeredSynergies = new Set<SkillTag>();

    public static resetRun(): void {
        this.keyboardCount = 0;
        this.survivalCount = 0;
        this.controlCount = 0;
        this.greedCount = 0;
        this.coinBonusRate = 0;
        this.monsterSpeedPenaltyRate = 0;
        this.nextWaveShield = 0;
        this.nextWaveMonsterSpeedMultiplier = 1;
        this.nextWaveFreezeSeconds = 0;
        this.maxHpPenalty = 0;
        this.triggeredSynergies.clear();
    }

    public static addTag(tag: SkillTag): boolean {
        if (tag === 'keyboard') {
            this.keyboardCount += 1;
            return this.markSynergyIfReady(tag, this.keyboardCount);
        }

        if (tag === 'survival') {
            this.survivalCount += 1;
            return this.markSynergyIfReady(tag, this.survivalCount);
        }

        if (tag === 'control') {
            this.controlCount += 1;
            return this.markSynergyIfReady(tag, this.controlCount);
        }

        this.greedCount += 1;
        return this.markSynergyIfReady(tag, this.greedCount);
    }

    public static consumeNextWaveShield(): number {
        const shield = this.nextWaveShield;
        this.nextWaveShield = 0;
        return shield;
    }

    public static consumeNextWaveMonsterSpeedMultiplier(): number {
        const multiplier = this.nextWaveMonsterSpeedMultiplier;
        this.nextWaveMonsterSpeedMultiplier = 1;
        return multiplier;
    }

    public static consumeNextWaveFreezeSeconds(): number {
        const seconds = this.nextWaveFreezeSeconds;
        this.nextWaveFreezeSeconds = 0;
        return seconds;
    }

    private static markSynergyIfReady(tag: SkillTag, count: number): boolean {
        if (count < 2 || this.triggeredSynergies.has(tag)) {
            return false;
        }

        this.triggeredSynergies.add(tag);
        return true;
    }
}
