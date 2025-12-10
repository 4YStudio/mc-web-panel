#!/bin/bash
# 由于系统 /tmp 空间不足，指定本地目录作为临时解压路径
mkdir -p temp_runtime
export TMPDIR=$(pwd)/temp_runtime

# 运行程序
./mc-web-panel-linux-x64

# 程序退出后清理临时文件
echo "Cleaning up temporary runtime files..."
rm -rf temp_runtime
