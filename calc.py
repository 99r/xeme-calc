from math import floor
from collections.abc import Iterable, Callable
from typing import TypeAlias
from itertools import chain
from decimal import Decimal

# Total order of sets
Order: TypeAlias = list[set[int]]

def get_height(order: Order, value: int):
    for x in range(0, len(order)):
        if value in order[x]:
            return x
    raise Exception("Not in set")

def xemmify(value: int, base: int = 10) -> int:
    return ((value % base) + floor(value / base)) % base

inv_xm_cache: dict[tuple[int, int, int], set[int]] = {}
def inverse_xemmify(value: int, bound: int, base: int = 10) -> set[int]:
    global inv_xm_cache
    key = (value, bound, base)
    if key in inv_xm_cache:
        return inv_xm_cache[key]

    out = set()

    for x in range(bound):
        if value == xemmify(x):
            out.add(x)       

    inv_xm_cache[key] = out
    return out

def inverse_xemmify_multi(values: Iterable[int], bound: int, base: int = 10) -> set[int]:
    return set(chain.from_iterable([inverse_xemmify(x, bound, base) for x in values]))

def hostify_order(order: Order) -> Order:
    order.insert(0, set())
    return order

def make_reme_player_order(bound: int, base: int = 10) -> Order:
    order: Order = []

    order.extend([inverse_xemmify(x, bound, base) for x in range(1, base)])
    order.append(inverse_xemmify(0, bound, base))
    return order

def make_reme_host_order(bound: int, base: int = 10):
    return hostify_order(make_reme_player_order(bound, base))


def make_jeme_player_order(bound: int) -> list[set[int]]:
    order: Order = []

    order.append(inverse_xemmify_multi([2, 3, 4, 5], bound))
    order.extend([inverse_xemmify(x, bound) for x in range(6, 10)])
    order.append(inverse_xemmify_multi([0, 1], bound))

    return order

def make_jeme_host_order(bound: int):
    return hostify_order(make_jeme_player_order(bound))

def make_leme_player_order(bound: int) -> list[set[int]]:
    order: Order = []

    order.append(inverse_xemmify_multi([2, 9], bound))
    order.extend([inverse_xemmify(x, bound) for x in range(3, 9)])
    order.append(inverse_xemmify_multi([1, 0], bound))

    return order

def make_leme_host_order(bound: int) -> list[set[int]]:
    order: Order = []

    order.append(set())
    order.extend([inverse_xemmify(x, bound) for x in range(2, 8)])
    order.append(inverse_xemmify_multi([8, 9], bound))
    order.append(inverse_xemmify_multi([1, 0], bound))

    return order

def get_reme_weight(num: int, base: int = 10):
    xem = xemmify(num, base)
    if xem == 0:
        return 3
    return 2

def get_jeme_weight(num: int):
    xem = xemmify(num)
    if xem == 0:
        return 5
    if xem == 1:
        return 4
    return 2

def get_leme_weight(num: int):
    xem = xemmify(num)
    if xem == 0:
        return 4
    if xem == 1:
        return 3
    return 2

# Gets the EV wrt. player in terms of the balance after one game. Assumes a 1 unit bet.
def get_ev(player_order: Order, opponent_order: Order, weight_func: Callable[[int], int], bound: int):
    ev = Decimal(0)
    p = Decimal(1) / Decimal(bound ** 2)
    for host_num in range(bound):
        for player_num in range(bound):
            if get_height(player_order, player_num) < get_height(opponent_order, host_num):
                continue
            ev += p * Decimal(weight_func(player_num))
    return ev

# Gets the edge of the opponent
def get_edge(ev, rounds):
    return (Decimal(1) - (Decimal(ev) ** Decimal(rounds))) 


# example usage 

# if __name__ == '__main__':
#     exclusive_upper_bound = 37 # Roulette goes from 0 to 36
#     reme_player_order = make_reme_player_order(exclusive_upper_bound)
#     reme_host_order = make_reme_host_order(exclusive_upper_bound)
#     print(f"({r}r REME) house edge: {round(get_edge(reme_ev, r) * 100, 2)}%")

