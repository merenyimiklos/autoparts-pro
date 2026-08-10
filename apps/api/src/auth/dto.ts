import { IsEmail,IsString,MinLength } from 'class-validator';
export class LoginDto{@IsEmail()email!:string;@IsString()@MinLength(8)password!:string}
export class RegisterDto extends LoginDto{@IsString()@MinLength(2)firstName!:string;@IsString()@MinLength(2)lastName!:string}
export class RequestResetDto{@IsEmail()email!:string}
export class ResetPasswordDto{@IsString()token!:string;@IsString()@MinLength(8)password!:string}
