from abc import ABC, abstractmethod
from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class RawDetection:
    x: float
    y: float
    width: float
    height: float
    confidence: float
    class_name: str = "person"


class PersonDetector(ABC):
    @abstractmethod
    def detect(self, image: np.ndarray) -> list[RawDetection]:
        raise NotImplementedError
