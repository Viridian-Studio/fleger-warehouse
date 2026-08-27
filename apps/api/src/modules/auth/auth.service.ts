import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User } from '../users/schemas/user.schema';
import { TenantMembership } from '../tenants/schemas/membership.schema';
import { Tenant } from '../tenants/schemas/tenant.schema';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(TenantMembership.name) private readonly memberships: Model<TenantMembership>,
    @InjectModel(Tenant.name) private readonly tenants: Model<Tenant>,
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

    const tokens = await this.issueTokens(user);

    // If user has no active tenant memberships and is not a platform/super admin, reject
    if (tokens.user.memberships.length === 0 && !tokens.user.platformAdmin && !tokens.user.superAdmin) {
      throw new UnauthorizedException('Your workspace is not active. Please contact your administrator.');
    }

    return tokens;
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

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException('New password must differ from the current password');
    }
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordMustChange = false;
    await user.save();

    // Activate any INVITED memberships now that the user has completed first-login setup
    await this.memberships.updateMany(
      { userId: user._id, status: 'INVITED' },
      { $set: { status: 'ACTIVE' } }
    );

    return this.issueTokens(user);
  }

  async updateProfile(userId: string, updates: { username?: string; email?: string }) {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');

    if (updates.username && updates.username !== user.username) {
      const existing = await this.users.findOne({ username: updates.username.toLowerCase(), _id: { $ne: user._id } });
      if (existing) throw new BadRequestException('Username already taken');
      user.username = updates.username;
    }
    if (updates.email && updates.email !== user.email) {
      const existing = await this.users.findOne({ email: updates.email.toLowerCase(), _id: { $ne: user._id } });
      if (existing) throw new BadRequestException('Email already in use');
      user.email = updates.email;
    }
    await user.save();
    return this.issueTokens(user);
  }

  private async issueTokens(user: User & { _id: Types.ObjectId }) {
    const memberships = await this.memberships.find({ userId: user._id, status: 'ACTIVE' });

    // Filter out memberships whose tenant is not ACTIVE
    const tenantIds = memberships.map((m) => m.tenantId);
    const activeTenants = tenantIds.length > 0
      ? await this.tenants.find({ _id: { $in: tenantIds }, status: 'ACTIVE' }).select('_id').lean()
      : [];
    const activeTenantIds = new Set(activeTenants.map((t) => String(t._id)));
    const activeMemberships = memberships.filter((m) => activeTenantIds.has(String(m.tenantId)));

    const payload = {
      sub: String(user._id),
      username: user.username,
      email: user.email,
      platformAdmin: user.platformAdmin || user.superAdmin,
      superAdmin: user.superAdmin,
      passwordMustChange: user.passwordMustChange ?? false,
      memberships: activeMemberships.map((item) => ({
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
