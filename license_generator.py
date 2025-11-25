#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
License Manager and Generator Script
Combined functionality for NetworkPlanningTool
"""

import datetime
import json
import os
import sys
import hashlib
import base64
import hmac
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

        print(f"Encrypted license generated valid until: {expire_date.strftime('%Y-%m-%d')}")

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


def main():
    print("Network Planning Tool - License Manager and Generator")
    print("=" * 50)

    # Provide options to user
    print("Options:")
    print("1. Generate New License")
    print("2. Check Existing License")
    print("3. Both Generate and Check")

    try:
        choice = input("\nSelect option (1-3, default 1): ").strip()
        if not choice:
            choice = "1"
        else:
            choice = int(choice)
    except ValueError:
        print("Invalid input. Using default option 1 (Generate New License).")
        choice = 1

    # Create license manager
    lm = LicenseManager("license.dat")  # Standard filename for the app

    if choice in [1, 3]:
        # Generate license option
        try:
            days = input("Enter number of days for license (default 30): ").strip()
            if not days:
                days = 30
            else:
                days = int(days)
        except ValueError:
            print("Invalid input. Using default 30 days.")
            days = 30

        # Generate license
        try:
            lm.generate_license(days=days)
            print(f"\nLicense generated successfully!")
            print(f"Valid for {days} days")
            print(f"Current date: {datetime.datetime.now().strftime('%Y-%m-%d')}")
            expire_date = (datetime.datetime.now() + datetime.timedelta(days=days)).strftime('%Y-%m-%d')
            print(f"Expires on: {expire_date}")
            print(f"License file created: license.dat")
            print(f"File size: {os.path.getsize('license.dat')} bytes")

            if choice == 1:
                print("\nTo use with NetworkPlanningTool:")
                print("1. Place 'license.dat' in the same directory as the executable")
                print("2. Run NetworkPlanningTool")

        except Exception as e:
            print(f"Error generating license: {str(e)}")

    if choice in [2, 3]:
        # Check license option
        print("\nChecking existing license...")
        is_valid, message = lm.check_license()
        if is_valid:
            print(f"✓ {message}")
        else:
            print(f"✗ {message}")

    if choice not in [1, 2, 3]:
        print("Invalid choice. Please select 1, 2, or 3.")


if __name__ == "__main__":
    main()