import fs from 'fs/promises';
import path from 'path';

export class JsonFileStorage {
    private dataDir: string;

    constructor(dataDir: string = 'data') {
        this.dataDir = path.join(process.cwd(), dataDir);
    }

    private async ensureDir() {
        try {
            await fs.access(this.dataDir);
        } catch {
            await fs.mkdir(this.dataDir, { recursive: true });
        }
    }

    async save<T>(filename: string, data: T): Promise<void> {
        await this.ensureDir();
        const filePath = path.join(this.dataDir, filename);
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    }

    async load<T>(filename: string): Promise<T | null> {
        await this.ensureDir();
        const filePath = path.join(this.dataDir, filename);
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(content) as T;
        } catch (error) {
            // Return null if file doesn't exist or is invalid
            return null;
        }
    }
}

export const jsonStorage = new JsonFileStorage();
