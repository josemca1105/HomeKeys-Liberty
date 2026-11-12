// Lets setImmediate callbacks and their mocked async continuations run before
// a test asserts on their side effects.
export const flushBackgroundTasks = async (): Promise<void> => {
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
};
