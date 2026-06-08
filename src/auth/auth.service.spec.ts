import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import {
  EmailAlreadyRegisteredException,
  InvalidCredentialsException,
} from '../common/exceptions/auth.exceptions';
import { AuthService } from './auth.service';
import { User } from './user.entity';

async function build(overrides: Partial<Record<keyof any, jest.Mock>> = {}) {
  const usersRepo = {
    existsBy: jest.fn(async () => false),
    findOne: jest.fn(),
    create: jest.fn((data) => data),
    save: jest.fn(async (data) => ({ id: 'u1', createdAt: new Date(), updatedAt: new Date(), ...data })),
    ...overrides,
  };
  const jwtService = { sign: jest.fn(() => 'signed.jwt.token') };

  const module = await Test.createTestingModule({
    providers: [
      AuthService,
      { provide: getRepositoryToken(User), useValue: usersRepo },
      { provide: JwtService, useValue: jwtService },
    ],
  }).compile();

  return { service: module.get(AuthService), usersRepo, jwtService };
}

describe('AuthService.register', () => {
  it('hashes the password and returns a signed token', async () => {
    const { service, usersRepo, jwtService } = await build();
    const result = await service.register({ email: 'A@example.com', password: 'pw-123456' });
    expect(usersRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'a@example.com' }),
    );
    const saved = usersRepo.save.mock.calls[0][0];
    expect(saved.passwordHash).not.toBe('pw-123456');
    await expect(bcrypt.compare('pw-123456', saved.passwordHash)).resolves.toBe(true);
    expect(jwtService.sign).toHaveBeenCalled();
    expect(result.accessToken).toBe('signed.jwt.token');
    expect(result.tokenType).toBe('Bearer');
  });

  it('rejects duplicate emails', async () => {
    const { service } = await build({ existsBy: jest.fn(async () => true) });
    await expect(
      service.register({ email: 'a@example.com', password: 'pw-123456' }),
    ).rejects.toBeInstanceOf(EmailAlreadyRegisteredException);
  });
});

describe('AuthService.login', () => {
  it('issues a token on a matching password', async () => {
    const passwordHash = await bcrypt.hash('pw-123456', 4);
    const { service, jwtService } = await build({
      findOne: jest.fn(async () => ({ id: 'u1', email: 'a@example.com', passwordHash })),
    });
    const result = await service.login({ email: 'a@example.com', password: 'pw-123456' });
    expect(jwtService.sign).toHaveBeenCalled();
    expect(result.accessToken).toBe('signed.jwt.token');
  });

  it('rejects unknown emails', async () => {
    const { service } = await build({ findOne: jest.fn(async () => null) });
    await expect(
      service.login({ email: 'a@example.com', password: 'pw-123456' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsException);
  });

  it('rejects wrong passwords', async () => {
    const passwordHash = await bcrypt.hash('pw-123456', 4);
    const { service } = await build({
      findOne: jest.fn(async () => ({ id: 'u1', email: 'a@example.com', passwordHash })),
    });
    await expect(
      service.login({ email: 'a@example.com', password: 'wrong-pw' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsException);
  });
});
