import fs from 'fs';
import writeFileAtomic from 'write-file-atomic';
import path from 'path';

export type WriteObjectFileFn = <T>(filePath: string, data: T | string) => Promise<void>;
export async function writeObjectFile<T>(filePath: string, data: T | string): Promise<void> {
  return await writeFileAtomic(filePath, typeof data !== 'string' ? JSON.stringify(data, null, 2) : data);
}

export async function readObjectFile<T>(filePath: string): Promise<T> {
  return <T>JSON.parse((await fs.promises.readFile(filePath)).toString());
}

export function filePath(target: string[] | string) {
  return Array.isArray(target) ? target.join(path.sep) : target;
}

export async function dirPath(target: string[] | string): Promise<string> {
  const dirPath = filePath(target);
  await fs.promises.mkdir(dirPath, { recursive: true });
  return dirPath;
}
