import { _decorator, Color, Component, Graphics, Node, Sprite, SpriteFrame, UITransform, Vec3 } from 'cc';
import { BasicMonster } from './BasicMonster';
import { SfxController } from './SfxController';
import { getExistingComponent, getOrAddComponent } from './ComponentLookup';

const { ccclass, property } = _decorator;

type MonsterKind = 'normal' | 'tough' | 'fast';

type MonsterConfig = {
    kind: MonsterKind;
    speedMultiplier: number;
    hp: number;
    damage: number;
    size: number;
    color: Color;
    artPath: string;
    spriteFrame: SpriteFrame | null;
};

@ccclass('BasicMonsterSpawner')
export class BasicMonsterSpawner extends Component {
    @property(Node)
    public monsterLayer: Node | null = null;

    @property(Node)
    public homeBase: Node | null = null;

    @property
    public spawnInterval = 1.8;

    @property
    public monsterSpeed = 112;

    @property
    public monsterSize = 72;

    @property
    public monsterDamage = 6;

    @property
    public spawnOffsetX = 20;

    @property
    public spawnYRange = 160;

    @property
    public defaultWaveMonsterCount = 5;

    @property(Color)
    public monsterColor = new Color(210, 78, 68, 255);

    @property(SpriteFrame)
    public monsterNeihaoSprite: SpriteFrame | null = null;

    @property(SpriteFrame)
    public monsterCuihuoSprite: SpriteFrame | null = null;

    @property(SpriteFrame)
    public monsterShuaiguoSprite: SpriteFrame | null = null;

    private readonly _homeWorldPosition = new Vec3();
    private readonly _spawnWorldPosition = new Vec3();
    private _targetSpawnCount = 0;
    private _spawnedCount = 0;
    private _currentWave = 1;
    private _waveSpawning = false;
    private _monsterSpeedMultiplier = 1;
    private _nextWaveMonsterSpeedMultiplier = 1;
    private _currentWaveMonsterSpeedMultiplier = 1;
    private _nextWaveSpawnIntervalMultiplier = 1;
    private _nextWaveOpeningFreezeSeconds = 0;
    private _currentWaveOpeningFreezeSeconds = 0;
    private _waveStartTimeMs = 0;
    private readonly _hasPlayedIntroSfx = new Set<MonsterKind>();

    public get isWaveSpawnComplete(): boolean {
        return this._targetSpawnCount > 0 && this._spawnedCount >= this._targetSpawnCount;
    }

    protected start(): void {
        // P006 后由 WaveController 统一启动当前波，避免生成器自启动造成重复生成。
    }

    protected onEnable(): void {
        // Restart is controlled explicitly by restartSpawning().
    }

    protected onDisable(): void {
        this.stopSpawning();
    }

    public restartSpawning(): void {
        this.node.active = true;
        this.enabled = true;
        this.startWave(this.defaultWaveMonsterCount, 1);
    }

    public startWave(monsterCount: number, waveNumber = 1): void {
        if (!this.monsterLayer || !this.homeBase) {
            console.warn('[BasicMonsterSpawner] 请绑定 monsterLayer 和 homeBase。');
            return;
        }

        this.node.active = true;
        this.enabled = true;
        this.stopSpawning();
        this._targetSpawnCount = Math.max(0, Math.floor(monsterCount));
        this._spawnedCount = 0;
        this._currentWave = Math.max(1, Math.floor(waveNumber));
        this._currentWaveMonsterSpeedMultiplier = this._nextWaveMonsterSpeedMultiplier;
        this._currentWaveOpeningFreezeSeconds = this._nextWaveOpeningFreezeSeconds;
        this._waveStartTimeMs = Date.now();

        if (this._targetSpawnCount <= 0) {
            this._waveSpawning = false;
            return;
        }

        this._waveSpawning = true;
        this.spawnMonster();
        if (!this.isWaveSpawnComplete) {
            this.schedule(this.spawnMonster, this.getCurrentSpawnInterval());
        }
        this._nextWaveSpawnIntervalMultiplier = 1;
        this._nextWaveMonsterSpeedMultiplier = 1;
        this._nextWaveOpeningFreezeSeconds = 0;
    }

    public applyMonsterSpeedMultiplier(multiplier: number): void {
        if (multiplier <= 0) {
            return;
        }

        this._monsterSpeedMultiplier = Math.max(0.7, this._monsterSpeedMultiplier * multiplier);
    }

    public applyNextWaveSpawnIntervalMultiplier(multiplier: number): void {
        if (multiplier <= 0) {
            return;
        }

        this._nextWaveSpawnIntervalMultiplier = Math.min(1.6, this._nextWaveSpawnIntervalMultiplier * multiplier);
    }

    public applyNextWaveMonsterSpeedMultiplier(multiplier: number): void {
        if (multiplier <= 0) {
            return;
        }

        this._nextWaveMonsterSpeedMultiplier = Math.max(0.7, this._nextWaveMonsterSpeedMultiplier * multiplier);
    }

    public applyNextWaveOpeningFreeze(seconds: number): void {
        if (seconds <= 0) {
            return;
        }

        this._nextWaveOpeningFreezeSeconds = Math.max(this._nextWaveOpeningFreezeSeconds, seconds);
    }

    public resetSkillModifiers(): void {
        this._monsterSpeedMultiplier = 1;
        this._nextWaveMonsterSpeedMultiplier = 1;
        this._currentWaveMonsterSpeedMultiplier = 1;
        this._nextWaveSpawnIntervalMultiplier = 1;
        this._nextWaveOpeningFreezeSeconds = 0;
        this._currentWaveOpeningFreezeSeconds = 0;
    }

    private stopSpawning(): void {
        this.unschedule(this.spawnMonster);
        this._waveSpawning = false;
    }

    private spawnMonster = (): void => {
        if (!this.monsterLayer || !this.homeBase || !this._waveSpawning) {
            return;
        }

        if (this._spawnedCount >= this._targetSpawnCount) {
            this.stopSpawning();
            return;
        }

        const monsterNode = new Node('BasicMonster');
        monsterNode.layer = this.monsterLayer.layer;
        this.monsterLayer.addChild(monsterNode);

        const config = this.getMonsterConfig(this.getMonsterKindForCurrentSpawn());
        this.applyMonsterSprite(monsterNode, config);
        const monster = monsterNode.addComponent(BasicMonster);
        monster.setup(
            this.homeBase,
            this.monsterSpeed * config.speedMultiplier * this._monsterSpeedMultiplier * this._currentWaveMonsterSpeedMultiplier,
            config.size,
            config.color,
            config.damage,
            config.hp,
            config.artPath,
            config.spriteFrame,
        );
        const freezeSeconds = this.getOpeningFreezeRemainingSeconds();
        if (freezeSeconds > 0) {
            monster.freezeForSeconds(freezeSeconds);
        }
        this.playMonsterIntroSfx(config.kind);

        this.homeBase.getWorldPosition(this._homeWorldPosition);
        this._spawnWorldPosition.set(
            this.getRightSpawnWorldX(config.size),
            this._homeWorldPosition.y + this.getRandomSpawnOffsetY(),
            this._homeWorldPosition.z,
        );
        monsterNode.setWorldPosition(this._spawnWorldPosition);

        this._spawnedCount += 1;
        if (this._spawnedCount >= this._targetSpawnCount) {
            this.stopSpawning();
        }
    };

    private applyMonsterSprite(monsterNode: Node, config: MonsterConfig): void {
        const transform = getOrAddComponent(monsterNode, UITransform);
        transform.setContentSize(config.size, config.size);

        const sprite = monsterNode.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.enabled = !!config.spriteFrame;
        sprite.spriteFrame = config.spriteFrame;

        if (!config.spriteFrame) {
            return;
        }

        const graphics = getExistingComponent(monsterNode, Graphics);
        if (graphics) {
            graphics.enabled = false;
        }
    }

    private getRightSpawnWorldX(monsterSize: number): number {
        const visibleInset = Math.max(72, monsterSize * 0.8);
        const parent = this.monsterLayer?.parent;
        const parentTransform = getExistingComponent(parent, UITransform);

        if (parent && parentTransform) {
            const parentWorldPosition = parent.worldPosition;
            return parentWorldPosition.x + parentTransform.width * 0.5 - visibleInset + this.spawnOffsetX;
        }

        const canvas = this.findAncestorByName(this.node, 'Canvas');
        const canvasTransform = getExistingComponent(canvas, UITransform);

        if (canvas && canvasTransform) {
            const canvasWorldPosition = canvas.worldPosition;
            return canvasWorldPosition.x + canvasTransform.width * 0.5 - visibleInset + this.spawnOffsetX;
        }

        return this._homeWorldPosition.x + 560;
    }

    private getRandomSpawnOffsetY(): number {
        if (this.spawnYRange <= 0) {
            return 0;
        }

        return (Math.random() - 0.5) * this.spawnYRange;
    }

    private getCurrentSpawnInterval(): number {
        const baseInterval = this.getBaseSpawnIntervalForCurrentWave();
        return Math.max(0.6, baseInterval * this._nextWaveSpawnIntervalMultiplier);
    }

    private getBaseSpawnIntervalForCurrentWave(): number {
        if (this._currentWave <= 1) {
            return 2;
        }

        if (this._currentWave === 2) {
            return 1.9;
        }

        if (this._currentWave === 3) {
            return 1.5;
        }

        if (this._currentWave === 4) {
            return 1.3;
        }

        const endlessPressure = Math.floor(Math.max(0, this._currentWave - 6) / 4) * 0.08;
        return Math.max(0.85, 1.2 - endlessPressure);
    }

    private getOpeningFreezeRemainingSeconds(): number {
        if (this._currentWaveOpeningFreezeSeconds <= 0 || this._waveStartTimeMs <= 0) {
            return 0;
        }

        const elapsedSeconds = Math.max(0, (Date.now() - this._waveStartTimeMs) / 1000);
        return Math.max(0, this._currentWaveOpeningFreezeSeconds - elapsedSeconds);
    }

    private getMonsterKindForCurrentSpawn(): MonsterKind {
        if (this._currentWave <= 1) {
            return 'normal';
        }

        if (this._currentWave === 2) {
            return 'normal';
        }

        if (this._currentWave === 3) {
            if (this._spawnedCount === 4 || this._spawnedCount === 10) {
                return 'tough';
            }

            if (this._spawnedCount === 2 || this._spawnedCount === 8) {
                return 'fast';
            }

            return 'normal';
        }

        if (this._currentWave === 4) {
            if (this._spawnedCount === 3 || this._spawnedCount === 9 || this._spawnedCount === 15) {
                return 'tough';
            }

            if (this._spawnedCount === 1 || this._spawnedCount === 5 || this._spawnedCount === 11 || this._spawnedCount === 14) {
                return 'fast';
            }

            return 'normal';
        }

        if (this._currentWave >= 10) {
            if (this._spawnedCount % 7 === 3 || this._spawnedCount % 11 === 8) {
                return 'tough';
            }

            if (this._spawnedCount % 5 === 1 || this._spawnedCount % 9 === 5) {
                return 'fast';
            }

            return 'normal';
        }

        if (this._spawnedCount === 3 || this._spawnedCount === 8 || this._spawnedCount === 13 || this._spawnedCount === 18) {
            return 'tough';
        }

        if (this._spawnedCount === 1 || this._spawnedCount === 5 || this._spawnedCount === 10 || this._spawnedCount === 15 || this._spawnedCount === 20) {
            return 'fast';
        }

        return 'normal';
    }

    private getMonsterConfig(kind: MonsterKind): MonsterConfig {
        const hpMultiplier = this.getEndlessHpMultiplier();
        const speedMultiplier = this.getEndlessSpeedMultiplier();
        if (kind === 'tough') {
            return {
                kind,
                speedMultiplier: 0.78 * speedMultiplier,
                hp: Math.max(1, Math.ceil((this._currentWave >= 5 ? 4 : 3) * hpMultiplier)),
                damage: 8,
                size: this.monsterSize + 8,
                color: new Color(150, 90, 220, 255),
                artPath: 'art/monsters/monster_shuai_guo',
                spriteFrame: this.monsterShuaiguoSprite,
            };
        }

        if (kind === 'fast') {
            return {
                kind,
                speedMultiplier: 1.35 * speedMultiplier,
                hp: Math.max(1, Math.ceil(1 * hpMultiplier)),
                damage: 5,
                size: this.monsterSize - 4,
                color: new Color(238, 170, 70, 255),
                artPath: 'art/monsters/monster_cui_huo',
                spriteFrame: this.monsterCuihuoSprite,
            };
        }

        return {
            kind,
            speedMultiplier,
            hp: Math.max(1, Math.ceil((this._currentWave <= 2 ? 1 : 2) * hpMultiplier)),
            damage: this.monsterDamage,
            size: this.monsterSize,
            color: this.monsterColor,
            artPath: 'art/monsters/monster_neihao',
            spriteFrame: this.monsterNeihaoSprite,
        };
    }

    private getEndlessHpMultiplier(): number {
        const endlessWaveOffset = Math.max(0, this._currentWave - 5);
        const tenWaveBonus = Math.floor(Math.max(0, this._currentWave) / 10) * 0.15;
        return 1 + endlessWaveOffset * 0.1 + tenWaveBonus;
    }

    private getEndlessSpeedMultiplier(): number {
        const endlessWaveOffset = Math.max(0, this._currentWave - 5);
        const tenWaveBonus = Math.floor(Math.max(0, this._currentWave) / 10) * 0.04;
        return Math.min(1.6, 1 + endlessWaveOffset * 0.025 + tenWaveBonus);
    }

    private playMonsterIntroSfx(kind: MonsterKind): void {
        if (this._hasPlayedIntroSfx.has(kind)) {
            return;
        }

        this._hasPlayedIntroSfx.add(kind);
        if (kind === 'fast') {
            SfxController.playSfx(this.node, 'monster_intro_cuihuo');
            return;
        }

        if (kind === 'tough') {
            SfxController.playSfx(this.node, 'monster_intro_shuaiguo');
            return;
        }

        SfxController.playSfx(this.node, 'monster_intro_neihao');
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
