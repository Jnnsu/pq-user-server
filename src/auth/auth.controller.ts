import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Request,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserService } from 'src/user/user.service';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  getUserTokenData,
  getUserTokenNotData,
} from './api-response/getUserTokenResponse';
import { SignUpSchema } from './schema/signup.schema';
import {
  signupNotData,
  signupSuccessData,
} from './api-response/signUpResponse';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  // 토큰으로 유저 확인
  @Get('user')
  @ApiOperation({
    summary: '토큰으로 로그인',
  })
  @getUserTokenNotData
  @getUserTokenData
  async getUser(@Request() request) {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) {
      throw new HttpException('토큰이 없습니다.', HttpStatus.BAD_REQUEST);
    }
    try {
      const email = (
        await this.authService.getUserInfo(token)
      ).UserAttributes.find((it) => it.Name === 'email').Value;
      return this.userService.getUser({ email });
    } catch (_) {
      throw new HttpException(
        '만료된 토큰이거나 잘못된 토큰입니다.',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  //회원가입
  @Post('signup')
  @ApiOperation({
    summary: '회원가입',
  })
  @ApiBody({ type: SignUpSchema })
  @signupSuccessData
  @signupNotData
  async signUp(@Body() data) {
    if (!data.email) {
      throw new HttpException('이메일은 필수입니다.', HttpStatus.NOT_FOUND);
    }
    if (!data.password) {
      throw new HttpException('비밀번호는 필수입니다.', HttpStatus.NOT_FOUND);
    }
    if (!data.nickname) {
      throw new HttpException('닉네임은 필수입니다.', HttpStatus.NOT_FOUND);
    }
    try {
      await this.authService.signUp(data.email, data.password);
      return await this.userService.createUser({
        email: data.email,
        nickname: data.nickname,
        state: '오프라인',
      });
    } catch (_) {
      throw new HttpException('회원가입에 실패했습니다.', HttpStatus.CONFLICT);
    }
  }

  // 이메일 인증
  @Post('signup/confirm')
  @ApiOperation({
    summary: '회원가입 이메일 인증',
  })
  async confirmSignUp(@Body() data) {
    try {
      await this.authService.confirmSignUp(data.email, data.code);
      await this.userService.updateUserState({
        email: data.email,
        state: '온라인',
      });
      return;
    } catch (_) {
      throw new HttpException(
        '코드가 만료되었거나 일치하지 않습니다!',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // 인증번호 다시보내기
  @Post('signup/resend')
  @ApiOperation({
    summary: '이메일 인증 다시 보내기',
  })
  async resendConfirmationCode(@Body() data) {
    if (!data.email) {
      throw new HttpException('이메일은 필수입니다.', HttpStatus.NOT_FOUND);
    }
    try {
      return this.authService.resendConfirmationCode(data.email);
    } catch (e) {
      return e;
    }
  }

  //로그인
  @Post('login')
  @ApiOperation({
    summary: '로그인',
  })
  async Login(@Body() data) {
    if (!data.email) {
      throw new HttpException('이메일은 필수입니다.', HttpStatus.NOT_FOUND);
    }
    if (!data.password) {
      throw new HttpException('비밀번호는 필수입니다.', HttpStatus.NOT_FOUND);
    }
    try {
      const res = await this.authService.Login(data.email, data.password);
      const userInfo = await this.userService.getUser({ email: data.email });
      return {
        userInfo,
        token: {
          accessToken: res.AuthenticationResult.AccessToken,
          refreshToken: res.AuthenticationResult.RefreshToken,
        },
      };
    } catch (e) {
      if (e.code === 'UserNotConfirmedException') {
        throw new HttpException('이메일을 인증하세요!', HttpStatus.CONFLICT);
      }
      throw new HttpException(
        '아이디 혹은 비밀번호가 틀렸습니다.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  //토큰 갱신
  @Get('token')
  @ApiOperation({
    summary: '리프레쉬 토큰으로 토큰 갱신',
  })
  async getToken(@Request() request) {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) {
      throw new HttpException('토큰이 없습니다.', HttpStatus.NOT_FOUND);
    }
    try {
      const res = (await this.authService.getToken(token)).AuthenticationResult
        .AccessToken;
      return { accessToken: res };
    } catch (_) {
      throw new HttpException(
        '토큰이 유효하지 않습니다.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}