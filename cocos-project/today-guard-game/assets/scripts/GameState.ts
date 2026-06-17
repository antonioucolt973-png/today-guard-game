import { Node } from 'cc';

export class GameState {
    public static isGameOver = false;
    public static isSkillTriggered = false;

    public static reset(): void {
        GameState.isGameOver = false;
        GameState.isSkillTriggered = false;
    }

    public static destroyAllBullets(bulletLayer: Node | null | undefined): void {
        if (!bulletLayer) {
            return;
        }

        for (const bullet of [...bulletLayer.children]) {
            bullet.destroy();
        }
    }
}
