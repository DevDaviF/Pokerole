function required<T>(data: T | undefined, message: string): NonNullable<T> {
  if (!data) {
    throw new Error(message);
  }
  return data;
}

function getDefault<T>(data: T | undefined, defaultValue: T): NonNullable<T> {
  if (!data) {
    return defaultValue as NonNullable<T>;
  }
  return data;
}

export default { required, getDefault };
