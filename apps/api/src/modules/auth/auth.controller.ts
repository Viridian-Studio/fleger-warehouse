import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { ChangePasswordDto, LoginDto, RefreshDto, UpdateProfileDto } from './dto/auth.dto';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  logout() {
    return this.auth.logout();
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  me(@Req() request: { user: unknown }) {
    return request.user;
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('change-password')
  changePassword(@Req() request: { user: { sub: string } }, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(request.user.sub, dto.currentPassword, dto.newPassword);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Patch('profile')
  updateProfile(@Req() request: { user: { sub: string } }, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(request.user.sub, dto);
  }
}
