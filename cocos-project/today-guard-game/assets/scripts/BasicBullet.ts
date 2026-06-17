import { _decorator, Color, Component, Graphics, Node, Sprite, SpriteFrame, UITransform, Vec3, isValid } from 'cc';
import { BattleStats } from './BattleStats';
import { FeedbackController } from './FeedbackController';
import { ArtSpriteHelper } from './ArtSpriteHelper';
import { GameState } from './GameState';
import { getExistingComponent, getOrAddComponent } from './ComponentLookup';

const { ccclass, property } = _decorator;

type DamageableMonsterLike = {
    takeDamage?: (damage: number) => boolean;
};

@ccclass('BasicBullet')
export class BasicBullet extends Component {
    @property(Node)
    public target: Node | null = null;

    @property(Node)
    public monsterLayer: Node | null = null;

    @property
    public speed = 480;

    @property
    public hitDistance = 24;

    @property
    public size = 36;

    @property
    public damage = 1;

    @property(Color)
    public color = new Color(120, 210, 255, 255);

    @property(SpriteFrame)
    public bulletSpriteFrame: SpriteFrame | null = null;

    @property
    public artPath = 'art/projectiles/projectile_keycap_esc';

    @property(BattleStats)
    public battleStats: BattleStats | null = null;

    private readonly _currentWorldPosition = new Vec3();
    private readonly _targetWorldPosition = new Vec3();
    private readonly _nextWorldPosition = new Vec3();
    private readonly _direction = new Vec3();
    private readonly _spawnWorldPosition = new Vec3();
    private _directionLocked = false;
    private _maxTravelDistance = 1600;
    private _screenDestroyMargin = 180;

    public setup(
        target: Node,
        speed: number,
        size: number,
        hitDistance: number,
        color: Color,
        battleStats?: BattleStats | null,
        damage = 1,
        bulletSpriteFrame: SpriteFrame | null = null,
        monsterLayer: Node | null = null,
    ): void {
        this.target = target;
        this.monsterLayer = monsterLayer;
        this.speed = speed;
        this.size = size;
        this.hitDistance = hitDistance;
        this.color = color.clone();
        this.battleStats = battleStats ?? null;
        this.damage = Math.max(1, Math.floor(damage));
        this.bulletSpriteFrame = bulletSpriteFrame;
        this.lockDirectionToTarget();
        this.drawPlaceholder();
    }

    protected onLoad(): void {
        this.drawPlaceholder();
    }

    protected update(deltaTime: number): void {
        if (GameState.isGameOver || GameState.isSkillTriggered) {
            this.node.destroy();
            return;
        }

        if (deltaTime <= 0) {
            return;
        }

        this.keepVisualVisible();

        this.node.getWorldPosition(this._currentWorldPosition);
        if (!this._directionLocked) {
            this.lockDirectionToTarget();
        }

        const hitMonster = this.findHitMonster();
        if (hitMonster) {
            FeedbackController.getForNode(this.node)?.playHitFeedback(hitMonster);
            const monster = this.findDamageableMonster(hitMonster);
            if (monster?.takeDamage(this.damage)) {
                this.battleStats?.addKill();
            }
            this.node.destroy();
            return;
        }

        this.moveForward(deltaTime);
        if (this.isOutOfRange()) {
            this.node.destroy();
        }
    }

    private isTargetAvailable(): boolean {
        return !!this.target && isValid(this.target) && this.target.activeInHierarchy;
    }

    private lockDirectionToTarget(): void {
        this.node.getWorldPosition(this._spawnWorldPosition);
        this._currentWorldPosition.set(this._spawnWorldPosition);

        if (this.isTargetAvailable()) {
            this.target!.getWorldPosition(this._targetWorldPosition);
            Vec3.subtract(this._direction, this._targetWorldPosition, this._spawnWorldPosition);
        }

        const length = this._direction.length();
        if (length > 0) {
            this._direction.multiplyScalar(1 / length);
        } else {
            this._direction.set(1, 0, 0);
        }

        this._directionLocked = true;
    }

    private moveForward(deltaTime: number): void {
        const directionLengthSq = this._direction.x * this._direction.x
            + this._direction.y * this._direction.y
            + this._direction.z * this._direction.z;
        if (directionLengthSq <= 0) {
            this._direction.set(1, 0, 0);
        }

        Vec3.scaleAndAdd(
            this._nextWorldPosition,
            this._currentWorldPosition,
            this._direction,
            this.speed * deltaTime,
        );
        this.node.setWorldPosition(this._nextWorldPosition);
    }

    private findHitMonster(): Node | null {
        if (!this.monsterLayer) {
            return null;
        }

        for (const monster of this.monsterLayer.children) {
            if (!isValid(monster) || !monster.activeInHierarchy) {
                continue;
            }

            monster.getWorldPosition(this._targetWorldPosition);
            const dx = this._targetWorldPosition.x - this._currentWorldPosition.x;
            const dy = this._targetWorldPosition.y - this._currentWorldPosition.y;
            const distanceSq = dx * dx + dy * dy;
            if (distanceSq <= this.hitDistance * this.hitDistance) {
                return monster;
            }
        }

        return null;
    }

    private isOutOfRange(): boolean {
        const canvas = this.findAncestorByName(this.node, 'Canvas');
        const canvasTransform = getExistingComponent(canvas, UITransform);
        if (canvasTransform) {
            const halfWidth = canvasTransform.width * 0.5 + this._screenDestroyMargin;
            const halfHeight = canvasTransform.height * 0.5 + this._screenDestroyMargin;
            const localPosition = this.node.position;
            return localPosition.x < -halfWidth
                || localPosition.x > halfWidth
                || localPosition.y < -halfHeight
                || localPosition.y > halfHeight;
        }

        this.node.getWorldPosition(this._currentWorldPosition);
        const dx = this._currentWorldPosition.x - this._spawnWorldPosition.x;
        const dy = this._currentWorldPosition.y - this._spawnWorldPosition.y;
        return dx * dx + dy * dy >= this._maxTravelDistance * this._maxTravelDistance;
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

    private drawPlaceholder(): void {
        this.ensureVisible();

        const transform = getOrAddComponent(this.node, UITransform);
        transform.setContentSize(this.size, this.size);

        const graphics = getOrAddComponent(this.node, Graphics);
        if (this.applyConfiguredSpriteFrame()) {
            if (graphics) {
                graphics.enabled = false;
                graphics.clear();
            }
            return;
        }

        if (!graphics) {
            return;
        }

        graphics.enabled = true;
        graphics.clear();
        graphics.fillColor = this.color;
        const radius = this.size * 0.5;
        graphics.circle(0, 0, radius);
        graphics.fill();

        if (this.artPath) {
            ArtSpriteHelper.applySprite(this.node, this.artPath, this.size * 1.6, this.size * 1.6, false);
        }
    }

    private ensureVisible(): void {
        this.node.active = true;

        const scale = this.node.scale;
        if (scale.x === 0 || scale.y === 0 || scale.z === 0) {
            this.node.setScale(scale.x === 0 ? 1 : scale.x, scale.y === 0 ? 1 : scale.y, scale.z === 0 ? 1 : scale.z);
        }
    }

    private keepVisualVisible(): void {
        this.ensureVisible();
        if (this.applyConfiguredSpriteFrame()) {
            return;
        }

        const graphics = getExistingComponent(this.node, Graphics);
        if (graphics) {
            graphics.enabled = true;
        }
    }

    private applyConfiguredSpriteFrame(): boolean {
        const existingSprite = getExistingComponent(this.node, Sprite);
        const spriteFrame = this.bulletSpriteFrame ?? existingSprite?.spriteFrame ?? null;
        if (!spriteFrame) {
            return false;
        }

        const sprite = existingSprite ?? getOrAddComponent(this.node, Sprite);
        if (!sprite) {
            return false;
        }

        this.bulletSpriteFrame = spriteFrame;
        sprite.spriteFrame = spriteFrame;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.enabled = true;
        return true;
    }

    private findDamageableMonster(node: Node): DamageableMonsterLike | null {
        for (const component of node.components) {
            const candidate = component as unknown as DamageableMonsterLike;
            if (typeof candidate.takeDamage === 'function') {
                return candidate;
            }
        }

        return null;
    }
}
