import { IsString, IsEmail, IsNotEmpty } from 'class-validator';
export class RegisterCustomerDto {
    @IsString()
    @IsNotEmpty()
    readonly name: string;
  
    @IsEmail()
    @IsNotEmpty()
    readonly email: string;
  
    @IsString()
    @IsNotEmpty()
    readonly password: string;
}