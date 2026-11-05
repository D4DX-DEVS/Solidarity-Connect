const shim = new URL('../mongoose/index.js', import.meta.url).href;

export async function resolve(specifier, context, next) {
  if (specifier === 'mongoose') return { url: shim, shortCircuit: true };
  return next(specifier, context);
}
