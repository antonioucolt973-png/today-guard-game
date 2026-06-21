import { _decorator, Color, Component, Graphics, Node, Sprite, SpriteFrame, UITransform, Vec3, isValid } from 'cc';
import { ArtSpriteHelper } from './ArtSpriteHelper';
import { BasicBullet } from './BasicBullet';
import { BattleStats } from './BattleStats';
import { GameState } from './GameState';
import { HomeBaseHealth } from './HomeBaseHealth';
import { SaveDataManager } from './SaveDataManager';
import { SfxController } from './SfxController';
import { getOrAddComponent } from './ComponentLookup';

const { ccclass, property } = _decorator;

@ccclass('PlayerAutoAttack')
export class PlayerAutoAttack extends Component {
    @property(Node)
    public monsterLayer: Node | null = null;

    @property(Node)
    public bulletLayer: Node | null = null;

    @property(Node)
    public homeBase: Node | null = null;

    @property(HomeBaseHealth)
    public homeBaseHealth: HomeBaseHealth | null = null;

    @property(BattleStats)
    public battleStats: BattleStats | null = null;

    @property
    public attackInterval = 2.4;

    @property
    public bulletSpeed = 480;

    @property
    public bulletSize = 16;

    @property
    public hitDistance = 24;

    @property
    public bulletDamage = 1;

    @property(Color)
    public bulletColor = new Color(120, 210, 255, 255);

    @property(SpriteFrame)
    public bulletSpriteFrame: SpriteFrame | null = null;

    @property
    public drawPlaceholder = true;

    @property
    public placeholderSize = 42;

    @property(Color)
    public placeholderColor = new Color(95, 185, 120, 255);

    @property
    public playerArtPath = 'art/player/player_guard';

    @property
    public playerAttackArtPath = 'art/player/player_guard_attack';

    private readonly _homeWorldPosition = new Vec3();
    private readonly _monsterWorldPosition = new Vec3();
    private readonly _playerWorldPosition = new Vec3();
    private _attackTimer = 0;
    private _gameOverHandled = false;
    private _baseAttackInterval = 2.4;
    private _attackIntervalMultiplier = 1;
    private _temporaryAttackIntervalMultiplier = 1;
    private _upgradeAttackIntervalMultiplier = 1;
    private _bulletHitBonus = 0;
    private _bulletDamageBonus = 0;
    private _upgradeBulletDamageBonus = 0;

    protected onLoad(): void {
        this._baseAttackInterval = this.attackInterval;
        if (this.drawPlaceholder) {
            this.drawPlayerPlaceholder();
        }
    }

    protected start(): void {
        if (!this.homeBaseHealth && this.homeBase) {
            this.homeBaseHealth = this.findHomeBaseHealth(this.homeBase);
        }
        this.applyPersistentUpgrades();
    }

    protected update(deltaTime: number): void {
        if (GameState.isGameOver || GameState.isSkillTriggered || this.isGameOver()) {
            this.clearBullets();
            this._gameOverHandled = true;
            return;
        }

        if (deltaTime <= 0) {
            return;
        }

        this._attackTimer += deltaTime;
        if (this._attackTimer < this.attackInterval) {
            return;
        }

        this._attackTimer = 0;
        this.fireAtNearestMonsterToHomeBase();
    }

    private fireAtNearestMonsterToHomeBase(): void {
        if (!this.bulletLayer) {
            console.warn('[PlayerAutoAttack] 请绑定 bulletLayer。');
            return;
        }

        const target = this.findNearestMonsterToHomeBase();
        if (!target) {
            this.showIdlePose();
            return;
        }

        this.showAttackPose();
        SfxController.playSfx(this.node, 'attack');

        const bulletNode = new Node('BasicBullet');
        bulletNode.layer = this.bulletLayer.layer;
        this.bulletLayer.addChild(bulletNode);

        this.node.getWorldPosition(this._playerWorldPosition);
        bulletNode.setWorldPosition(this._playerWorldPosition);

        const sprite = bulletNode.addComponent(Sprite);
        sprite.spriteFrame = this.bulletSpriteFrame;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;

        const bullet = bulletNode.addComponent(BasicBullet);
        bullet.setup(
            target,
            this.bulletSpeed,
            this.bulletSize,
            this.hitDistance + this._bulletHitBonus,
            this.bulletColor,
            this.battleStats,
            this.bulletDamage + this._bulletDamageBonus + this._upgradeBulletDamageBonus,
            this.bulletSpriteFrame,
            this.monsterLayer,
        );
    }

    public resetAttack(): void {
        this._attackTimer = 0;
        this._gameOverHandled = false;
        GameState.isSkillTriggered = false;
        this.resetAttackInterval();
        this.resetBulletHitBonus();
        this.resetBulletDamageBonus();
        this.applyPersistentUpgrades();
        this.clearBullets();
    }

    public applyAttackIntervalMultiplier(multiplier: number): void {
        if (multiplier <= 0) {
            return;
        }

        this._attackIntervalMultiplier = Math.max(0.55, this._attackIntervalMultiplier * multiplier);
        this.refreshAttackInterval();
        this._attackTimer = 0;
    }

    public applyTemporaryAttackIntervalMultiplier(multiplier: number): void {
        if (multiplier <= 0) {
            return;
        }

        this._temporaryAttackIntervalMultiplier = Math.max(0.65, multiplier);
        this.refreshAttackInterval();
        this._attackTimer = 0;
    }

    public resetAttackInterval(): void {
        this._attackIntervalMultiplier = 1;
        this._temporaryAttackIntervalMultiplier = 1;
        this.refreshAttackInterval();
    }

    public clearTemporaryAttackBoost(): void {
        this._temporaryAttackIntervalMultiplier = 1;
        this.refreshAttackInterval();
    }

    public addBulletHitBonus(amount: number): void {
        if (amount <= 0) {
            return;
        }

        this._bulletHitBonus = Math.min(42, this._bulletHitBonus + amount);
    }

    public resetBulletHitBonus(): void {
        this._bulletHitBonus = 0;
    }

    public addBulletDamageBonus(amount: number): void {
        if (amount <= 0) {
            return;
        }

        this._bulletDamageBonus = Math.min(6, this._bulletDamageBonus + Math.floor(amount));
    }

    public resetBulletDamageBonus(): void {
        this._bulletDamageBonus = 0;
    }

    private refreshAttackInterval(): void {
        this.attackInterval = Math.max(
            0.6,
            this._baseAttackInterval
                * this._upgradeAttackIntervalMultiplier
                * this._attackIntervalMultiplier
                * this._temporaryAttackIntervalMultiplier,
        );
    }

    public applyPersistentUpgrades(): void {
        const saveData = SaveDataManager.load();
        const keyboardLevel = Math.max(0, Math.floor(saveData.upgrades.keyboard ?? 0));
        const coffeeLevel = Math.max(0, Math.floor(saveData.upgrades.coffee ?? 0));
        this._upgradeBulletDamageBonus = keyboardLevel;
        this._upgradeAttackIntervalMultiplier = Math.max(0.5, 1 - coffeeLevel * 0.05);
        this.refreshAttackInterval();
    }

    private findNearestMonsterToHomeBase(): Node | null {
        if (!this.monsterLayer || !this.homeBase) {
            return null;
        }

        this.homeBase.getWorldPosition(this._homeWorldPosition);

        let nearest: Node | null = null;
        let nearestDistanceSq = Number.POSITIVE_INFINITY;

        for (const monster of this.monsterLayer.children) {
            if (!isValid(monster) || !monster.activeInHierarchy) {
                continue;
            }

            monster.getWorldPosition(this._monsterWorldPosition);
            const dx = this._monsterWorldPosition.x - this._homeWorldPosition.x;
            const dy = this._monsterWorldPosition.y - this._homeWorldPosition.y;
            const distanceSq = dx * dx + dy * dy;

            if (distanceSq < nearestDistanceSq) {
                nearest = monster;
                nearestDistanceSq = distanceSq;
            }
        }

        return nearest;
    }

    private isGameOver(): boolean {
        if (!this.homeBaseHealth && this.homeBase) {
            this.homeBaseHealth = this.findHomeBaseHealth(this.homeBase);
        }

        return !!this.homeBaseHealth?.isGameOver;
    }

    private findHomeBaseHealth(node: Node): HomeBaseHealth | null {
        for (const component of node.components) {
            const candidate = component as Component & { isGameOver?: boolean; takeDamage?: (damage: number) => void };
            if (typeof candidate.takeDamage === 'function' || typeof candidate.isGameOver === 'boolean') {
                return component as HomeBaseHealth;
            }
        }

        return null;
    }

    private clearBullets(): void {
        if (!this.bulletLayer) {
            return;
        }

        for (const bullet of [...this.bulletLayer.children]) {
            bullet.destroy();
        }
    }

    private drawPlayerPlaceholder(): void {
        const transform = getOrAddComponent(this.node, UITransform);
        transform.setContentSize(this.placeholderSize, this.placeholderSize);

        const graphics = getOrAddComponent(this.node, Graphics);
        graphics.clear();
        graphics.fillColor = this.placeholderColor;
        const halfSize = this.placeholderSize * 0.5;
        graphics.roundRect(-halfSize, -halfSize, this.placeholderSize, this.placeholderSize, 8);
        graphics.fill();

        if (this.playerArtPath) {
            ArtSpriteHelper.applySprite(this.node, this.playerArtPath, this.placeholderSize, this.placeholderSize * 1.25);
        }
    }

    private showAttackPose(): void {
        if (!this.playerAttackArtPath) {
            return;
        }

        ArtSpriteHelper.applySprite(this.node, this.playerAttackArtPath, this.placeholderSize, this.placeholderSize * 1.25);
        this.scheduleOnce(() => {
            if (this.node.isValid && this.playerArtPath) {
                ArtSpriteHelper.applySprite(this.node, this.playerArtPath, this.placeholderSize, this.placeholderSize * 1.25);
            }
        }, 0.16);
    }

    private showIdlePose(): void {
        if (!this.playerArtPath) {
            return;
        }

        ArtSpriteHelper.applySprite(this.node, this.playerArtPath, this.placeholderSize, this.placeholderSize * 1.25);
    }
}
