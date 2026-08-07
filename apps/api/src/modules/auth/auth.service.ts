import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User } from '../users/schemas/user.schema';
import { TenantMembership } from '../tenants/schemas/membership.schema';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(TenantMembership.name) private readonly memberships: Model<TenantMembership>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService
  ) {}

  async login(identifier: string, password: string) {
    const normalizedIdentifier = identifier.toLowerCase();
    const user = await this.users.findOne({
      globalStatus: 'ACTIVE',
      $or: [{ email: normalizedIdentifier }, { username: normalizedIdentifier }]
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueTokens(user);
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; type?: string }>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET')
      });
      if (payload.type !== 'refresh') throw new UnauthorizedException('Invalid refresh token');

      const user = await this.users.findOne({ _id: payload.sub, globalStatus: 'ACTIVE' });
      if (!user) throw new UnauthorizedException('Invalid refresh token');

      return this.issueTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  logout() {
    return { success: true };
  }

  private async issueTokens(user: User & { _id: Types.ObjectId }) {
    const memberships = await this.memberships.find({ userId: user._id, status: 'ACTIVE' });
    const payload = {
      sub: String(user._id),
      username: user.username,
      email: user.email,
      platformAdmin: user.platformAdmin || user.superAdmin,
      superAdmin: user.superAdmin,
      memberships: memberships.map((item) => ({
        tenantId: String(item.tenantId),
        tenantSlug: item.tenantSlug,
        status: item.status,
        permissions: item.permissions
      }))
    };

    return {
      accessToken: await this.jwt.signAsync(payload),
      refreshToken: await this.jwt.signAsync(
        { sub: payload.sub, type: 'refresh' },
        {
          secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
          expiresIn: Number(this.config.get<string>('JWT_REFRESH_EXPIRES_IN_SECONDS') ?? 60 * 60 * 24 * 30)
        }
      ),
      user: payload
    };
  }
}
