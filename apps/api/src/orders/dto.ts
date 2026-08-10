import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';

export class CheckoutAddressDto {
  @IsString() recipient!: string;
  @IsString() postalCode!: string;
  @IsString() city!: string;
  @IsString() street!: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() phone?: string;
}

export class CheckoutDto {
  @IsEmail() email!: string;
  @ValidateNested() @Type(() => CheckoutAddressDto) shippingAddress!: CheckoutAddressDto;
  @ValidateNested() @Type(() => CheckoutAddressDto) billingAddress!: CheckoutAddressDto;
  @IsIn(['cod', 'transfer', 'mock-card']) paymentMethod!: string;
  @IsIn(['home', 'parcel', 'pickup']) shippingMethod!: string;
}
