import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { CreateBucketCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly bucket = process.env.MINIO_BUCKET ?? 'autoparts';
  private readonly client = new S3Client({ region: 'us-east-1', endpoint: `http://${process.env.MINIO_ENDPOINT ?? 'minio'}:${process.env.MINIO_PORT ?? '9000'}`, forcePathStyle: true, credentials: { accessKeyId: process.env.MINIO_ACCESS_KEY ?? 'autoparts', secretAccessKey: process.env.MINIO_SECRET_KEY ?? 'autoparts-secret' } });
  async onModuleInit() { try { await this.client.send(new HeadBucketCommand({ Bucket: this.bucket })); } catch { await this.client.send(new CreateBucketCommand({ Bucket: this.bucket })); } }
  private imageMagic(file: Express.Multer.File) {
    const b = file.buffer;
    if (file.mimetype === 'image/jpeg') return b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    if (file.mimetype === 'image/png') return b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
    if (file.mimetype === 'image/webp') return b.length > 12 && b.subarray(0,4).toString() === 'RIFF' && b.subarray(8,12).toString() === 'WEBP';
    return false;
  }
  async put(file: Express.Multer.File) {
    if (!this.imageMagic(file)) throw new BadRequestException('A fájl tartalma nem egyezik a megadott képtípussal.');
    const ext = file.mimetype === 'image/jpeg' ? 'jpg' : file.mimetype === 'image/png' ? 'png' : 'webp';
    const key = `products/${randomUUID()}.${ext}`;
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: file.buffer, ContentType: file.mimetype }));
    return key;
  }
  async putDocument(file: Express.Multer.File) {
    if (file.mimetype !== 'application/pdf' || file.buffer.subarray(0, 5).toString() !== '%PDF-') throw new BadRequestException('Csak valódi PDF dokumentum tölthető fel.');
    const key = `documents/${randomUUID()}.pdf`;
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: file.buffer, ContentType: 'application/pdf' }));
    return key;
  }
  async get(key: string) { return this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key })); }
}
