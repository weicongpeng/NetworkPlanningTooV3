#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
License Generator - CLI Version
Command-line interface for NetworkPlanningTool license generation
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


class LicenseGenerator:
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


# For compatibility with existing code
def create_key():
    """Generate a new encryption key"""
    return Fernet.generate_key()


def print_menu():
    """打印菜单选项"""
    print("\n" + "="*50)
    print("Network Planning Tool - License Generator")
    print("="*50)
    print("请选择操作:")
    print("1. 生成新许可证")
    print("2. 退出")
    print("="*50)


def get_user_choice():
    """获取用户选择"""
    try:
        choice = input("请输入选项编号 (1-2): ").strip()
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
    print("欢迎使用 Network Planning Tool 许可证生成器！")

    while True:
        print_menu()
        choice = get_user_choice()

        if choice == "1":
            # 生成许可证
            days = get_days_input()
            license_generator = LicenseGenerator("license.dat")
            try:
                result_msg = license_generator.generate_license(days=days)
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
                print(f"1. 将 'license.dat' 放在 NetworkPlanningTool 程序的同一目录下")
                print(f"2. 运行 NetworkPlanningTool")
            except Exception as e:
                print(f"生成许可证时出错: {str(e)}")

        elif choice == "2":
            # 退出
            print("感谢使用！再见！")
            sys.exit(0)

        else:
            print("无效的选择，请输入 1-2 之间的数字。")

        # 询问是否继续
        continue_choice = input("\n按 Enter 键继续，输入 'q' 退出: ").strip().lower()
        if continue_choice == 'q':
            print("感谢使用！再见！")
            sys.exit(0)


if __name__ == "__main__":
    main()