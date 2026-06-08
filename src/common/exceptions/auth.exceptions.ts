import { ConflictException, UnauthorizedException } from '@nestjs/common';

export class EmailAlreadyRegisteredException extends ConflictException {
  constructor(email: string) {
    super(`Email "${email}" is already registered`);
  }
}

export class InvalidCredentialsException extends UnauthorizedException {
  constructor() {
    super('Invalid email or password');
  }
}
