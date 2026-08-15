cmake_minimum_required(VERSION 3.22.1)
project("native-signature")

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(native-signature SHARED native_signature.cpp)

find_library(log-lib log)
target_link_libraries(native-signature ${log-lib})