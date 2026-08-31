from abc import ABC, abstractmethod
from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class SahiTile:
    x: int
    y: int
    width: int
    height: int
    image: np.ndarray


class SahiTiler(ABC):
    @abstractmethod
    def tile(self, image: np.ndarray) -> list[SahiTile]:
        raise NotImplementedError
