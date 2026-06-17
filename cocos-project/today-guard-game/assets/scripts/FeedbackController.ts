import { _decorator, AudioClip, AudioSource, Color, Component, Label, Node, UITransform, Vec3, isValid, resources, tween } from 'cc';
import { getOrAddComponent } from './ComponentLookup';

const { ccclass, property } = _decorator;

@ccclass('FeedbackController')
export class FeedbackController extends Component {
    @property(AudioSource)
    public audioSource: AudioSource | null = null;

    @property(AudioClip)
    public clickClip: AudioClip | null = null;

    @property(AudioClip)
    public hitClip: AudioClip | null = null;

    @property(AudioClip)
    public hurtClip: AudioClip | null = null;

    @property(AudioClip)
    public skillClip: AudioClip | null = null;

    @property(AudioClip)
    public victoryClip: AudioClip | null = null;

    @property(AudioClip)
    public gameOverClip: AudioClip | null = null;

    @property(Node)
    public homeBaseNode: Node | null = null;

    @property(Label)
    public feedbackLabel: Label | null = null;

    @property
    public feedbackTextY = -220;

    @property
    public feedbackTextWidth = 420;

    @property
    public feedbackTextHeight = 42;

    private _defaultClipsLoaded = false;

    protected onLoad(): void {
        this.audioSource = this.audioSource ?? getOrAddComponent(this.node, AudioSource);
        this.loadDefaultClips();
    }

    public static getForNode(node: Node | null): FeedbackController | null {
        const canvas = FeedbackController.findAncestorByName(node, 'Canvas') ?? node;
        if (!canvas) {
            return null;
        }

        for (const component of canvas.components) {
            if (component instanceof FeedbackController) {
                return component;
            }
        }

        return canvas.addComponent(FeedbackController);
    }

    public playClickFeedback(targetNode?: Node | null): void {
        this.loadDefaultClips();
        this.playClip(this.clickClip);
        this.pulseNode(targetNode ?? this.node, 1.04);
    }

    public playSkillFeedback(targetNode?: Node | null): void {
        this.loadDefaultClips();
        this.playClip(this.skillClip ?? this.clickClip);
        this.pulseNode(targetNode ?? this.node, 1.06);
    }

    public playHitFeedback(targetNode?: Node | null): void {
        this.loadDefaultClips();
        this.playClip(this.hitClip);
        this.pulseNode(targetNode, 1.08);
    }

    public playHurtFeedback(targetNode?: Node | null): void {
        this.loadDefaultClips();
        this.playClip(this.hurtClip);
        this.pulseNode(targetNode ?? this.homeBaseNode, 1.12);
    }

    public playGameOverFeedback(targetNode?: Node | null): void {
        this.loadDefaultClips();
        this.playClip(this.gameOverClip);
        this.pulseNode(targetNode, 1.06);
        this.showToast('今天没守住', new Color(255, 110, 110, 255));
    }

    public playVictoryFeedback(targetNode?: Node | null): void {
        this.loadDefaultClips();
        this.playClip(this.victoryClip);
        this.pulseNode(targetNode, 1.06);
        this.showToast('今天守住了', new Color(120, 235, 160, 255));
    }

    private playClip(clip: AudioClip | null): void {
        if (!this.audioSource || !clip) {
            return;
        }

        this.audioSource.playOneShot(clip, 1);
    }

    private loadDefaultClips(): void {
        if (this._defaultClipsLoaded) {
            return;
        }

        this._defaultClipsLoaded = true;
        this.loadDefaultClip('audio/click', (clip) => { this.clickClip = this.clickClip ?? clip; });
        this.loadDefaultClip('audio/hit', (clip) => { this.hitClip = this.hitClip ?? clip; });
        this.loadDefaultClip('audio/hurt', (clip) => { this.hurtClip = this.hurtClip ?? clip; });
        this.loadDefaultClip('audio/skill', (clip) => { this.skillClip = this.skillClip ?? clip; });
        this.loadDefaultClip('audio/victory', (clip) => { this.victoryClip = this.victoryClip ?? clip; });
        this.loadDefaultClip('audio/gameover', (clip) => { this.gameOverClip = this.gameOverClip ?? clip; });
    }

    private loadDefaultClip(path: string, assign: (clip: AudioClip) => void): void {
        resources.load(path, AudioClip, (error, clip) => {
            if (error || !clip) {
                return;
            }

            assign(clip);
        });
    }

    private pulseNode(node: Node | null | undefined, scaleMultiplier: number): void {
        if (!node || !isValid(node)) {
            return;
        }

        const defaultScale = node.scale.clone();
        const pulseScale = new Vec3(
            defaultScale.x * scaleMultiplier,
            defaultScale.y * scaleMultiplier,
            defaultScale.z,
        );
        tween(node)
            .to(0.06, { scale: pulseScale })
            .to(0.08, { scale: defaultScale })
            .start();
    }

    private showToast(text: string, color: Color): void {
        const label = this.getOrCreateFeedbackLabel();
        if (!label) {
            return;
        }

        label.string = text;
        label.color = color;
        label.node.active = true;
        this.unschedule(this.hideToast);
        this.scheduleOnce(this.hideToast, 0.45);
    }

    private hideToast = (): void => {
        if (this.feedbackLabel) {
            this.feedbackLabel.node.active = false;
        }
    };

    private getOrCreateFeedbackLabel(): Label | null {
        if (this.feedbackLabel && isValid(this.feedbackLabel.node)) {
            return this.feedbackLabel;
        }

        const canvas = FeedbackController.findAncestorByName(this.node, 'Canvas') ?? this.node;
        if (!canvas) {
            return null;
        }

        let labelNode = canvas.getChildByName('FeedbackLabel');
        if (!labelNode) {
            labelNode = new Node('FeedbackLabel');
            labelNode.layer = canvas.layer;
            canvas.addChild(labelNode);

            const transform = labelNode.addComponent(UITransform);
            transform.setContentSize(this.feedbackTextWidth, this.feedbackTextHeight);
        }

        labelNode.setPosition(0, this.feedbackTextY, 0);
        labelNode.setSiblingIndex((labelNode.parent?.children.length ?? 1) - 1);

        const transform = getOrAddComponent(labelNode, UITransform);
        transform.setContentSize(this.feedbackTextWidth, this.feedbackTextHeight);

        this.feedbackLabel = getOrAddComponent(labelNode, Label);
        this.feedbackLabel.fontSize = 24;
        this.feedbackLabel.lineHeight = 30;
        this.feedbackLabel.horizontalAlign = 1;
        this.feedbackLabel.verticalAlign = 1;
        return this.feedbackLabel;
    }

    private static findAncestorByName(node: Node | null, name: string): Node | null {
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
