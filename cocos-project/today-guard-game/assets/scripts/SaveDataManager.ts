import { sys } from 'cc';

export type UpgradeKey = 'keyboard' | 'coffee' | 'desk';

export type SaveData = {
    version: number;
    totalCoins: number;
    bestWave: number;
    upgrades: Record<UpgradeKey, number>;
    hasSeenTutorial: boolean;
};

export class SaveDataManager {
    public static readonly storageKey = 'today_guard_save_v1';
    public static readonly currentVersion = 1;

    public static load(): SaveData {
        const rawData = this.readRawData();
        if (!rawData) {
            const defaultData = this.createDefaultData();
            this.save(defaultData);
            return defaultData;
        }

        try {
            const parsedData = JSON.parse(rawData) as Partial<SaveData>;
            const normalizedData = this.normalizeData(parsedData);
            this.save(normalizedData);
            return normalizedData;
        } catch (error) {
            console.warn('[SaveDataManager] Save data is broken, reset to default.', error);
            const defaultData = this.createDefaultData();
            this.save(defaultData);
            return defaultData;
        }
    }

    public static save(data: SaveData): void {
        const normalizedData = this.normalizeData(data);
        try {
            sys.localStorage.setItem(this.storageKey, JSON.stringify(normalizedData));
        } catch (error) {
            console.warn('[SaveDataManager] Failed to save data.', error);
        }
    }

    public static reset(): SaveData {
        const defaultData = this.createDefaultData();
        this.save(defaultData);
        return defaultData;
    }

    public static addCoins(amount: number): SaveData {
        const data = this.load();
        data.totalCoins = Math.max(0, data.totalCoins + this.toNonNegativeInteger(amount));
        this.save(data);
        return data;
    }

    public static spendCoins(amount: number): { success: boolean; data: SaveData } {
        const data = this.load();
        const cost = this.toNonNegativeInteger(amount);
        if (data.totalCoins < cost) {
            return { success: false, data };
        }

        data.totalCoins -= cost;
        this.save(data);
        return { success: true, data };
    }

    public static getUpgradeCost(key: UpgradeKey): number {
        const level = this.getUpgradeLevel(key);
        return 20 + level * 10;
    }

    public static getUpgradeLevel(key: UpgradeKey): number {
        return this.load().upgrades[key] ?? 0;
    }

    public static upgrade(key: UpgradeKey): { success: boolean; cost: number; data: SaveData } {
        const data = this.load();
        const currentLevel = data.upgrades[key] ?? 0;
        const cost = 20 + currentLevel * 10;
        if (data.totalCoins < cost) {
            return { success: false, cost, data };
        }

        data.totalCoins -= cost;
        data.upgrades[key] = currentLevel + 1;
        this.save(data);
        return { success: true, cost, data };
    }

    public static updateBestWave(wave: number): { isNewRecord: boolean; data: SaveData } {
        const data = this.load();
        const normalizedWave = this.toNonNegativeInteger(wave);
        if (normalizedWave <= data.bestWave) {
            return { isNewRecord: false, data };
        }

        data.bestWave = normalizedWave;
        this.save(data);
        return { isNewRecord: true, data };
    }

    public static markTutorialSeen(): SaveData {
        const data = this.load();
        data.hasSeenTutorial = true;
        this.save(data);
        return data;
    }

    public static createDefaultData(): SaveData {
        return {
            version: this.currentVersion,
            totalCoins: 0,
            bestWave: 0,
            upgrades: {
                keyboard: 0,
                coffee: 0,
                desk: 0,
            },
            hasSeenTutorial: false,
        };
    }

    private static normalizeData(data: Partial<SaveData> | null | undefined): SaveData {
        const defaultData = this.createDefaultData();
        const upgrades = (data?.upgrades ?? {}) as Partial<Record<UpgradeKey, number>>;

        return {
            version: this.currentVersion,
            totalCoins: this.toNonNegativeInteger(data?.totalCoins ?? defaultData.totalCoins),
            bestWave: this.toNonNegativeInteger(data?.bestWave ?? defaultData.bestWave),
            upgrades: {
                keyboard: this.toNonNegativeInteger(upgrades.keyboard ?? defaultData.upgrades.keyboard),
                coffee: this.toNonNegativeInteger(upgrades.coffee ?? defaultData.upgrades.coffee),
                desk: this.toNonNegativeInteger(upgrades.desk ?? defaultData.upgrades.desk),
            },
            hasSeenTutorial: typeof data?.hasSeenTutorial === 'boolean' ? data.hasSeenTutorial : defaultData.hasSeenTutorial,
        };
    }

    private static readRawData(): string | null {
        try {
            return sys.localStorage.getItem(this.storageKey);
        } catch (error) {
            console.warn('[SaveDataManager] Failed to read save data.', error);
            return null;
        }
    }

    private static toNonNegativeInteger(value: unknown): number {
        const numberValue = Number(value);
        if (!Number.isFinite(numberValue)) {
            return 0;
        }

        return Math.max(0, Math.floor(numberValue));
    }
}
