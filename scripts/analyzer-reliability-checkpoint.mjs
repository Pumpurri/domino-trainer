import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

export const RELIABILITY_CHECKPOINT_SCHEMA = 1;

function stableConfig(config) {
  return JSON.stringify(config);
}

async function atomicJsonWrite(destination, value) {
  const temporary = join(
    resolve(destination, '..'),
    `.${basename(destination)}.${process.pid}.${Date.now()}.tmp`,
  );
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, destination);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function prepareReliabilityCheckpoint({ directory, config, resume = false }) {
  const root = resolve(directory);
  const positionsDirectory = join(root, 'positions');
  const manifestPath = join(root, 'manifest.json');
  await mkdir(positionsDirectory, { recursive: true });

  let manifest;
  try {
    manifest = await readJson(manifestPath);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  if (manifest) {
    if (!resume) {
      throw new Error(`Checkpoint ${root} already exists. Pass --resume to continue it.`);
    }
    if (manifest.schema !== RELIABILITY_CHECKPOINT_SCHEMA) {
      throw new Error(`Checkpoint schema ${manifest.schema} is incompatible with ${RELIABILITY_CHECKPOINT_SCHEMA}.`);
    }
    if (stableConfig(manifest.config) !== stableConfig(config)) {
      throw new Error('Checkpoint configuration does not match this run. Use a different checkpoint directory.');
    }
  } else {
    if (resume) throw new Error(`Checkpoint ${root} does not exist, so it cannot be resumed.`);
    manifest = {
      schema: RELIABILITY_CHECKPOINT_SCHEMA,
      createdAt: new Date().toISOString(),
      config,
    };
    await atomicJsonWrite(manifestPath, manifest);
  }

  const files = (await readdir(positionsDirectory)).filter((name) => name.endsWith('.json')).sort();
  const results = [];
  for (const file of files) results.push(await readJson(join(positionsDirectory, file)));

  return {
    root,
    manifest,
    results,
    completedIds: new Set(results.map(({ id }) => id)),
    async save(result) {
      if (!result?.id || !/^[a-z0-9-]+$/i.test(result.id)) throw new Error('Checkpoint result has an invalid position id.');
      await atomicJsonWrite(join(positionsDirectory, `${result.id}.json`), result);
    },
  };
}
