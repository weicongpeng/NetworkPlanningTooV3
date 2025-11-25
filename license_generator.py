#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
License Generator Script
Use this to create a license file for NetworkPlanningTool
"""

import datetime
import sys
import os

# Add the path to import the license manager
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from license_manager import LicenseManager

def main():
    print("Network Planning Tool - License Generator")
    print("=" * 50)

    # Get number of days from user
    try:
        days = input("Enter number of days for license (default 30): ").strip()
        if not days:
            days = 30
        else:
            days = int(days)
    except ValueError:
        print("Invalid input. Using default 30 days.")
        days = 30

    # Create license manager
    lm = LicenseManager("license.dat")  # Standard filename for the app

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

        print("\nTo use with NetworkPlanningTool:")
        print("1. Place 'license.dat' in the same directory as the executable")
        print("2. Run NetworkPlanningTool")

    except Exception as e:
        print(f"Error generating license: {str(e)}")

if __name__ == "__main__":
    main()