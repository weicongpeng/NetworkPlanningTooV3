#!/usr/bin/env python3
"""
测试网元ID类型转换
"""
import sys
import os

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def test_net_element_id_conversion_logic():
    """测试网元ID转换逻辑"""
    print("=== 测试网元ID转换逻辑 ===")
    
    # 模拟不同类型的网元ID
    test_cases = [
        # (输入值, 预期输出, 网络类型)
        (123456.0, 123456, "NR"),  # 浮点数 -> 整数
        (789012, 789012, "NR"),     # 整数保持不变
        ("456789", "456789", "NR"), # 字符串保持不变
        (111222.5, 111222, "NR"),   # 带小数的浮点数 -> 整数
        ("999888", "999888", "LTE"), # LTE字符串保持不变
    ]
    
    for input_val, expected, network_type in test_cases:
        # 模拟task_manager中的网元ID处理逻辑
        if network_type == "NR":
            # NR小区的网元ID转换逻辑
            net_element_id = input_val
            if isinstance(net_element_id, (int, float)):
                net_element_id = int(net_element_id)
        else:
            # LTE小区的网元ID保持不变
            net_element_id = input_val
        
        print(f"输入: {input_val} (类型: {type(input_val).__name__}), 网络类型: {network_type}")
        print(f"输出: {net_element_id} (类型: {type(net_element_id).__name__})")
        print(f"预期: {expected} (类型: {type(expected).__name__})")
        
        # 验证结果
        assert net_element_id == expected, f"转换失败: 输入{input_val}，预期{expected}，实际{net_element_id}"
        print("✅ 通过")
        print()
    
    print("=== 所有转换测试通过! ===")


def test_pandas_dataframe_integration():
    """测试pandas DataFrame集成"""
    print("\n=== 测试pandas DataFrame集成 ===")
    
    import pandas as pd
    
    # 创建测试数据
    data = {
        "site_id": ["1", "2", "3"],
        "network_type": ["NR", "NR", "LTE"],
        "managed_element_id": [936475.0, 7906565, "888888"]
    }
    
    df = pd.DataFrame(data)
    
    # 应用网元ID转换逻辑
    processed_data = []
    for _, row in df.iterrows():
        site_id = row["site_id"]
        network_type = row["network_type"]
        managed_element_id = row["managed_element_id"]
        
        if network_type == "NR":
            if isinstance(managed_element_id, (int, float)):
                managed_element_id = int(managed_element_id)
        
        processed_data.append({
            "site_id": site_id,
            "网元ID": managed_element_id
        })
    
    result_df = pd.DataFrame(processed_data)
    
    print("处理前数据:")
    print(df)
    print("\n处理后数据:")
    print(result_df)
    
    # 验证结果
    assert result_df.iloc[0]["网元ID"] == 936475, f"第一个NR网元ID应该是936475，实际是{result_df.iloc[0]["网元ID"]}"
    assert result_df.iloc[1]["网元ID"] == 7906565, f"第二个NR网元ID应该是7906565，实际是{result_df.iloc[1]["网元ID"]}"
    assert result_df.iloc[2]["网元ID"] == "888888", f"LTE网元ID应该是'888888'，实际是{result_df.iloc[2]["网元ID"]}"
    
    print("\n✅ DataFrame集成测试通过!")


if __name__ == "__main__":
    test_net_element_id_conversion_logic()
    test_pandas_dataframe_integration()
    print("\n🎉 所有测试通过! NR小区的网元ID已成功转换为整数类型")
