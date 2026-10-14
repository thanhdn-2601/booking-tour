import { join } from 'path';

// Shared by ServeStaticModule (serving uploads) and anything that writes
// into or deletes from the public uploads tree, so both sides always agree
// on the same root regardless of the process's working directory.
export const PUBLIC_DIR = join(process.cwd(), 'public');
