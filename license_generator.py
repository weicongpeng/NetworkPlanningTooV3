#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
License Manager and Generator - CLI Version
Command-line interface for NetworkPlanningTool license management
"""

import datetime
import json
import os
import sys
import hashlib
import base64
import hmac
import argparse
from cryptography.fernet import Fernet


class LicenseManager:
    def __init__(self, license_path="license.dat", secret_key=None):
        # Use a hardcoded key (in production, this should be embedded securely in the compiled code)
        self.secret_key = secret_key or b'networkplanningtool_default_secret_key_for_encryption'
        self.license_path = license_path

    def generate_license(self, days=30):
        """Generate a new encrypted license file (for developer use)"""
        expire_date = datetime.datetime.now() + datetime.timedelta(days=days)

        # Create license data
        license_data = {
            'created_date': datetime.datetime.now().strftime('%Y-%m-%d'),
            'expire_date': expire_date.strftime('%Y-%m-%d'),
            'valid': True,
            'author': 'NetworkPlanningTool Developer'
        }

        # Serialize and encrypt the data
        serialized_data = json.dumps(license_data).encode()

        # Create a Fernet key from our secret key
        derived_key = base64.urlsafe_b64encode(hashlib.sha256(self.secret_key).digest())
        fernet = Fernet(derived_key)

        # Encrypt the data
        encrypted_data = fernet.encrypt(serialized_data)

        # Create a signature to prevent tampering
        signature = hmac.new(self.secret_key, encrypted_data, hashlib.sha256).hexdigest()

        # Package the encrypted data and signature
        license_package = {
            'encrypted_data': base64.b64encode(encrypted_data).decode('utf-8'),
            'signature': signature
        }

        # Write to file
        with open(self.license_path, 'wb') as f:
            f.write(json.dumps(license_package).encode('utf-8'))

        return f"Encrypted license generated valid until: {expire_date.strftime('%Y-%m-%d')}"

    def check_license(self):
        """Check if license is valid and hasn't expired"""
        if not os.path.exists(self.license_path):
            return False, "License file not found. 请联系作者：weicongpeng1@163.com或15220958556"

        try:
            # Read the encrypted license file
            with open(self.license_path, 'rb') as f:
                encrypted_content = f.read()

            # Parse the JSON
            try:
                license_package = json.loads(encrypted_content.decode('utf-8'))
            except UnicodeDecodeError:
                return False, "License file has been tampered with. 请联系作者：weicongpeng1@163.com或15220958556"

            # Extract encrypted data and signature
            try:
                encrypted_data = base64.b64decode(license_package['encrypted_data'])
                stored_signature = license_package['signature']
            except (KeyError, ValueError):
                return False, "License file has been tampered with. 请联系作者：weicongpeng1@163.com或15220958556"

            # Verify the signature
            calculated_signature = hmac.new(self.secret_key, encrypted_data, hashlib.sha256).hexdigest()

            if not hmac.compare_digest(calculated_signature, stored_signature):
                return False, "License file has been tampered with. 请联系作者：weicongpeng1@163.com或15220958556"

            # Decrypt the data
            derived_key = base64.urlsafe_b64encode(hashlib.sha256(self.secret_key).digest())
            fernet = Fernet(derived_key)
            try:
                decrypted_data = fernet.decrypt(encrypted_data)
            except Exception:
                return False, "License file has been tampered with. 请联系作者：weicongpeng1@163.com或15220958556"

            # Parse the decrypted data
            try:
                license_data = json.loads(decrypted_data.decode())
            except json.JSONDecodeError:
                return False, "License file has been tampered with. 请联系作者：weicongpeng1@163.com或15220958556"

            # Check expiration
            try:
                expire_date = datetime.datetime.strptime(license_data['expire_date'], '%Y-%m-%d')
            except ValueError:
                return False, "License file has been tampered with. 请联系作者：weicongpeng1@163.com或15220958556"

            current_date = datetime.datetime.now()

            if current_date > expire_date:
                return False, f"License expired on {license_data['expire_date']}. 请联系作者：weicongpeng1@163.com或15220958556"

            return True, "License valid"

        except Exception as e:
            return False, f"Invalid license file: {str(e)}"


# For compatibility with existing code
def create_key():
    """Generate a new encryption key"""
    return Fernet.generate_key()


def print_menu():
    """打印菜单选项"""
    print("\n" + "="*50)
    print("Network Planning Tool - License Manager and Generator")
    print("="*50)
    print("请选择操作:")
    print("1. 生成新许可证")
    print("2. 检查现有许可证")
    print("3. 生成并检查许可证")
    print("4. 退出")
    print("="*50)


def get_user_choice():
    """获取用户选择"""
    try:
        choice = input("请输入选项编号 (1-4): ").strip()
        return choice
    except KeyboardInterrupt:
        print("\n\n程序已退出。")
        sys.exit(0)


def get_days_input():
    """获取天数输入"""
    while True:
        try:
            days_input = input("请输入许可证有效天数 (默认30天): ").strip()
            if days_input == "":
                return 30
            days = int(days_input)
            if days <= 0:
                print("天数必须大于0，请重新输入。")
                continue
            return days
        except ValueError:
            print("请输入有效的数字。")
            continue


def main():
    print("欢迎使用 Network Planning Tool 许可证管理器！")

    while True:
        print_menu()
        choice = get_user_choice()

        if choice == "1":
            # 生成许可证
            days = get_days_input()
            license_manager = LicenseManager("license.dat")
            try:
                result_msg = license_manager.generate_license(days=days)
                print(result_msg)
                print(f"\n许可证生成成功!")
                print(f"有效天数: {days} 天")
                print(f"当前日期: {datetime.datetime.now().strftime('%Y-%m-%d')}")
                expire_date = (datetime.datetime.now() + datetime.timedelta(days=days)).strftime('%Y-%m-%d')
                print(f"到期日期: {expire_date}")
                print(f"许可证文件: license.dat")
                if os.path.exists('license.dat'):
                    print(f"文件大小: {os.path.getsize('license.dat')} 字节")
                print(f"\n使用说明:")
                print(f"1. 将 'license.dat' 放在可执行文件的同一目录下")
                print(f"2. 运行 NetworkPlanningTool")
            except Exception as e:
                print(f"生成许可证时出错: {str(e)}")

        elif choice == "2":
            # 检查许可证
            license_manager = LicenseManager("license.dat")
            print("正在检查现有许可证...")
            is_valid, message = license_manager.check_license()
            if is_valid:
                print(f"[OK] {message}")
            else:
                print(f"[ERROR] {message}")

        elif choice == "3":
            # 生成并检查许可证
            days = get_days_input()
            license_manager = LicenseManager("license.dat")
            try:
                # 首先生成许可证
                result_msg = license_manager.generate_license(days=days)
                print(result_msg)
                print(f"\n许可证生成成功!")
                print(f"有效天数: {days} 天")
                print(f"当前日期: {datetime.datetime.now().strftime('%Y-%m-%d')}")
                expire_date = (datetime.datetime.now() + datetime.timedelta(days=days)).strftime('%Y-%m-%d')
                print(f"到期日期: {expire_date}")
                print(f"许可证文件: license.dat")
                if os.path.exists('license.dat'):
                    print(f"文件大小: {os.path.getsize('license.dat')} 字节")

                # 然后检查生成的许可证
                print(f"\n正在验证生成的许可证...")
                is_valid, message = license_manager.check_license()
                if is_valid:
                    print(f"[OK] {message}")
                else:
                    print(f"[ERROR] {message}")
            except Exception as e:
                print(f"生成或检查许可证时出错: {str(e)}")

        elif choice == "4":
            # 退出
            print("感谢使用！再见！")
            sys.exit(0)

        else:
            print("无效的选择，请输入 1-4 之间的数字。")

        # 询问是否继续
        continue_choice = input("\n按 Enter 键继续，输入 'q' 退出: ").strip().lower()
        if continue_choice == 'q':
            print("感谢使用！再见！")
            sys.exit(0)


if __name__ == "__main__":
    main()