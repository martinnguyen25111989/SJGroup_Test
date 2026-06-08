import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import {
  EmailAlreadyRegisteredException,
  InvalidCredentialsException,
} from '../common/exceptions/auth.exceptions';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { User } from './user.entity';

const BCRYPT_ROUNDS = 10;

export interface AuthTokenResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: { id: string; email: string };
}

export interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly expiresIn = process.env.JWT_EXPIRES_IN ?? '1h';

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokenResponse> {
    const normalized = dto.email.toLowerCase();
    if (await this.users.existsBy({ email: normalized })) {
      throw new EmailAlreadyRegisteredException(normalized);
    }
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.users.save(
      this.users.create({ email: normalized, passwordHash }),
    );
    this.logger.log(`Registered user ${user.id} (${user.email})`);
    return this.issueToken(user);
  }

  async login(dto: LoginDto): Promise<AuthTokenResponse> {
    const normalized = dto.email.toLowerCase();
    const user = await this.users.findOne({ where: { email: normalized } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new InvalidCredentialsException();
    }
    this.logger.log(`User ${user.id} logged in`);
    return this.issueToken(user);
  }

  private issueToken(user: User): AuthTokenResponse {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = this.jwt.sign(payload);
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.expiresIn,
      user: { id: user.id, email: user.email },
    };
  }
}
