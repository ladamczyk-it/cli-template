export interface IRunResult {
  code: number;
  stdout: string;
}

export function run(args: string[]): IRunResult {
  return { code: 0, stdout: `cli-template ${args.join(' ')}\n` };
}
