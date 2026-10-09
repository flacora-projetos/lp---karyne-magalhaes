import fs from 'node:fs';
import path from 'node:path';

export function assertPrivateOutput(output, repo = process.cwd()) {
  let parent = path.dirname(path.resolve(output));
  const tail = [path.basename(output)];
  while (!fs.existsSync(parent)) {
    tail.unshift(path.basename(parent));
    parent = path.dirname(parent);
  }
  const resolved = path.resolve(fs.realpathSync(parent), ...tail).toLowerCase();
  const root = fs.realpathSync(repo).toLowerCase();
  if (resolved === root || resolved.startsWith(`${root}${path.sep}`)) throw new Error('A saída editorial privada deve ficar fora do repositório público.');
}
