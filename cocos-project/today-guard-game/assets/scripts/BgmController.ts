import { _decorator, AudioClip, AudioSource, Component, Node, resources } from 'cc';
import { getOrAddComponent } from './ComponentLookup';

const { ccclass, property } = _decorator;

type BgmName = 'battle' | 'pressure' | 'result';

@ccclass('BgmController')
export class BgmController extends Component {
    @property(AudioSource)
    public audioSource: AudioSource | null = null;

    @property(AudioClip)
    public battleClip: AudioClip | null = null;

    @property(AudioClip)
    public pressureClip: AudioClip | null = null;

    @property(AudioClip)
    public resultClip: AudioClip | null = null;

    @property
    public battleVolume = 0.34;

    @property
    public pressureVolume = 0.28;

    @property
    public resultVolume = 0.32;

    private _currentName: BgmName | '' = '';
    private _requestedName: BgmName | '' = '';
    private _defaultClipsLoaded = false;

    protected onLoad(): void {
        this.audioSource = this.audioSource ?? getOrAddComponent(this.node, AudioSource);
        this.loadDefaultClips();
    }

    public static getForNode(node: Node | null): BgmController | null {
        const canvas = BgmController.findAncestorByName(node, 'Canvas') ?? node;
        if (!canvas) {
            return null;
        }

        for (const component of canvas.components) {
            if (component instanceof BgmController) {
                return component;
            }
        }

        return canvas.addComponent(BgmController);
    }

    public static playBgm(node: Node | null, name: BgmName): void {
        BgmController.getForNode(node)?.playBgm(name);
    }

    public static stopBgm(node: Node | null): void {
        BgmController.getForNode(node)?.stopBgm();
    }

    public playBgm(name: BgmName): void {
        this._requestedName = name;
        this.audioSource = this.audioSource ?? getOrAddComponent(this.node, AudioSource);
        this.loadDefaultClips();

        if (!this.audioSource) {
            return;
        }

        const clip = this.getClip(name);
        if (!clip) {
            return;
        }

        if (this._currentName === name && this.audioSource.playing) {
            return;
        }

        this._currentName = name;
        this.audioSource.stop();
        this.audioSource.clip = clip;
        this.audioSource.loop = true;
        this.audioSource.volume = this.getVolume(name);
        this.audioSource.play();
    }

    public stopBgm(): void {
        if (!this.audioSource) {
            return;
        }

        this._currentName = '';
        this.audioSource.stop();
    }

    private getClip(name: BgmName): AudioClip | null {
        if (name === 'pressure') {
            return this.pressureClip ?? this.battleClip;
        }

        if (name === 'result') {
            return this.resultClip ?? this.battleClip;
        }

        return this.battleClip;
    }

    private getVolume(name: BgmName): number {
        if (name === 'pressure') {
            return this.pressureVolume;
        }

        if (name === 'result') {
            return this.resultVolume;
        }

        return this.battleVolume;
    }

    private loadDefaultClips(): void {
        if (this._defaultClipsLoaded) {
            return;
        }

        this._defaultClipsLoaded = true;
        this.loadDefaultClip('audio/bgm/bgm_battle', (clip) => { this.battleClip = this.battleClip ?? clip; });
        this.loadDefaultClip('audio/bgm/bgm_pressure', (clip) => { this.pressureClip = this.pressureClip ?? clip; });
        this.loadDefaultClip('audio/bgm/bgm_result', (clip) => { this.resultClip = this.resultClip ?? clip; });
    }

    private loadDefaultClip(path: string, assign: (clip: AudioClip) => void): void {
        resources.load(path, AudioClip, (error, clip) => {
            if (error || !clip) {
                return;
            }

            assign(clip);
            if (this._requestedName && this._requestedName !== this._currentName) {
                this.playBgm(this._requestedName);
            }
        });
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
