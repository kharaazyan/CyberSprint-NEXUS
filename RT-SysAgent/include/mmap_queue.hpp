#pragma once
#include <atomic>
#include <thread>
#include <cassert>
#include <cstdint>
#include "config.hpp"

constexpr size_t CACHELINE = Config::QueueConfig::CACHE_LINE_SIZE;

template<typename T>
struct alignas(CACHELINE) Slot {
    std::atomic<uint8_t> state; // 0 = empty, 1 = writing, 2 = full, 3 = reading
    alignas(CACHELINE) T value;
};

enum SlotState : uint8_t {
    EMPTY = 0,
    WRITING = 1,
    FULL = 2,
    READING = 3
};

template<typename T, size_t N>
struct alignas(CACHELINE) MmapQueue {
    static_assert((N & (N - 1)) == 0, "N must be power of 2");

    std::atomic<size_t> head;
    char pad1[CACHELINE - sizeof(head)];
    std::atomic<size_t> tail;
    char pad2[CACHELINE - sizeof(tail)];

    Slot<T> slots[N];

    void init() {
        head.store(0, std::memory_order_relaxed);
        tail.store(0, std::memory_order_relaxed);
        for (size_t i = 0; i < N; ++i)
            slots[i].state.store(EMPTY, std::memory_order_relaxed);
    }

    bool enqueue(const T& item) {
        for (int i = 0; i < Config::QueueConfig::MAX_RETRY_ATTEMPTS; ++i) {
            size_t pos = tail.fetch_add(1, std::memory_order_acq_rel) & (N - 1);
            auto& slot = slots[pos];

            uint8_t expected = EMPTY;
            if (slot.state.compare_exchange_strong(expected, WRITING, std::memory_order_acquire)) {
                slot.value = item;
                slot.state.store(FULL, std::memory_order_release);
                return true;
            }
            std::this_thread::sleep_for(std::chrono::milliseconds(Config::QueueConfig::YIELD_SLEEP_MS));
        }
        return false;
    }

    bool dequeue(T& out) {
        for (int i = 0; i < Config::QueueConfig::MAX_RETRY_ATTEMPTS; ++i) {
            size_t pos = head.fetch_add(1, std::memory_order_acq_rel) & (N - 1);
            auto& slot = slots[pos];

            uint8_t expected = FULL;
            if (slot.state.compare_exchange_strong(expected, READING, std::memory_order_acquire)) {
                out = slot.value;
                slot.state.store(EMPTY, std::memory_order_release);
                return true;
            }
            std::this_thread::sleep_for(std::chrono::milliseconds(Config::QueueConfig::YIELD_SLEEP_MS));
        }
        return false;
    }
};