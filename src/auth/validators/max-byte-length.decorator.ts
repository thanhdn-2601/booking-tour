import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function MaxByteLength(
  maxBytes: number,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'maxByteLength',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [maxBytes],
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          if (typeof value !== 'string') return false;
          const [max] = args.constraints as [number];
          return Buffer.byteLength(value, 'utf8') <= max;
        },
        defaultMessage(args: ValidationArguments): string {
          const [max] = args.constraints as [number];
          return `${args.property} must not exceed ${max} bytes when UTF-8 encoded`;
        },
      },
    });
  };
}
