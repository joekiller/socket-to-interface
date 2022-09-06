import { dirPath, filePath, readObjectFile, writeObjectFile, WriteObjectFileFn } from './utils';
import { deepShape, Shape } from './diff-shapes';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import JsonToTS from 'json-to-ts';
import SigIntManager from './SigIntManager';
import WSManager from '@joekiller/ws-manager';

class Stats {
  public sampled: number;
  public found: number;
  public shortestShape?: number;
  public shortestShapePath?: string;
  private readonly savePath: string;

  constructor(savePath: string) {
    this.savePath = savePath;
    this.sampled = this.found = 0;
  }

  async save(): Promise<void> {
    await writeObjectFile(this.savePath, {
      sampled: this.sampled,
      found: this.found,
      shortestShape: this.shortestShape,
      shortestShapePath: this.shortestShapePath,
    });
  }

  async load(): Promise<boolean> {
    try {
      ({
        sampled: this.sampled,
        found: this.found,
        shortestShape: this.shortestShape,
        shortestShapePath: this.shortestShapePath,
      } = await readObjectFile(this.savePath));
      return true;
    } catch (e) {
      console.error(`Error loading stats:`, e);
      return false;
    }
  }
}

class InterfaceDetector {
  private shapeKeys: Set<string>;
  constructor(
    private sigInt: SigIntManager,
    private stats: Stats,
    private socketManager: WSManager<string>,
    private shapeDir: string,
    private rawDir: string,
    private writeObjectFile: WriteObjectFileFn,
  ) {
    this.shapeKeys = new Set<string>();
    this.sigInt.onSigInt(this.onShutdown.bind(this));
  }

  /**
   * Process incoming messages to create a shape and hash the shape
   * @param message that is incoming
   * @param counterParams are used to indicate if, the message is "old" ie reprocessed so do not count it or
   *  if "resetStats" is indicated then include the message in the stats regardless of age
   */
  async processMessage(
    message: Shape,
    counterParams?: { old?: boolean; resetStats?: boolean },
  ): Promise<string | undefined> {
    if (!counterParams?.old || counterParams?.resetStats) {
      this.stats.sampled += 1;
    }
    const shape = deepShape(message);
    const shapeString = JSON.stringify(shape, null, 2);
    const key = crypto.createHash('md5').update(shapeString).digest('hex');
    if (!this.shapeKeys.has(key)) {
      this.shapeKeys.add(key);
      const shapePath = [this.shapeDir, `${key}.json`].join(path.sep);
      const rawPath = [this.rawDir, `${key}.json`].join(path.sep);
      if (!this.stats.shortestShape || shapeString.length < this.stats.shortestShape) {
        this.stats.shortestShape = shapeString.length;
        this.stats.shortestShapePath = shapePath;
      }
      console.log(
        `New shape. Total ${this.stats.found} of ${this.stats.sampled}. Shortest: ${
          this.stats.shortestShapePath ? this.stats.shortestShapePath : 'n/a'
        } Newest: ${key}`,
      );
      await this.writeObjectFile(shapePath, shapeString);
      // when we re-process if it's an old message, it was already a shape, so we don't write the raw.
      if (!counterParams?.old) {
        await this.writeObjectFile(rawPath, message);
      }
      if (counterParams?.resetStats || !counterParams?.old) {
        this.stats.found += 1;
      }
      return key;
    }
    return;
  }

  async watchMessages(): Promise<void> {
    const messages = this.socketManager.getMessages();
    if (messages.length > 0) {
      for (const message of messages) {
        await this.processMessage(message);
      }
    }
  }

  async loadExisting(): Promise<void> {
    const shapeDir = this.shapeDir;
    const existing = await fs.promises.readdir(shapeDir);
    const resetStats = !(await this.stats.load());
    for await (const file of existing) {
      const [name] = file.split('.');
      const shapePath = filePath([shapeDir, file]);
      const entry = await fs.promises.readFile(shapePath);
      if ((await this.processMessage(<Shape>JSON.parse(entry.toString()), { old: true, resetStats })) !== name) {
        await fs.promises.rm(shapePath);
        await fs.promises.rm(filePath([this.rawDir, file]), { force: true });
      }
    }
  }

  async run(): Promise<void> {
    const socketMessages = this.socketManager;
    await this.loadExisting();
    socketMessages.on('messages', () => {
      this.watchMessages().catch((e) => console.error(e));
    });
    socketMessages.on('error', (err) => this.sigInt.onFatalError(err));
    socketMessages.connect();
  }

  async onShutdown(): Promise<number> {
    console.log('shutting down handler.');
    this.socketManager.shutdown();
    this.socketManager.off('messages', () => {
      this.watchMessages().catch((e) => console.error(e));
    });
    await this.writeInterfaces();
    await this.stats.save();
    console.log('finished shutting down handler and exiting.');
    return 0;
  }

  /**
   * Given all the shapes we've collected, write an interface
   */
  async writeInterfaces() {
    const shapeDirPath = this.shapeDir;
    const interfaceDirPath = ['files', 'interfaces'].join(path.sep);
    await dirPath(interfaceDirPath);
    const existing = await fs.promises.readdir(shapeDirPath);
    const messages: { SocketEvents: Shape[] } = { SocketEvents: [] };
    for await (const file of existing) {
      const shapeFilePath = [shapeDirPath, file].join(path.sep);
      const entry = await fs.promises.readFile(shapeFilePath);
      messages.SocketEvents.push(<Shape>JSON.parse(entry.toString()));
    }
    const interfaces = [];
    for await (const typeInterface of JsonToTS(messages)) {
      interfaces.push(typeInterface);
    }
    const interfacePath = [interfaceDirPath, `index.d.ts`].join(path.sep);
    await writeObjectFile(interfacePath, interfaces.join('\n\n'));
    console.log(`Wrote detected interface to ${interfacePath}.`);
  }
}

/**
 * The main function creates a SigInt Manager and then runs the detector
 */
export async function main(address: string) {
  const sigInt = new SigIntManager();
  try {
    const socketMessages = new WSManager<string>(address);
    const stats: Stats = new Stats(filePath([await dirPath(['files']), 'stats.json']));
    const shapeDir = await dirPath(['files', 'shapes']);
    const rawDir = await dirPath(['files', 'raw']);
    const bpInterfaceDetector = new InterfaceDetector(sigInt, stats, socketMessages, shapeDir, rawDir, writeObjectFile);
    await bpInterfaceDetector.run();
  } catch (e) {
    sigInt.onFatalError(e);
  }
}
