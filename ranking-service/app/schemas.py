"""Request / response contract for POST /rank.

Node sends the user's (normalised) profile and the schemes that already passed the
eligibility engine. Rules are sent in the canonical vocabulary (docs/RULES_SCHEMA.md).
"""
from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field


class Profile(BaseModel):
    model_config = ConfigDict(extra="ignore")

    age: Optional[float] = None
    gender: Optional[str] = None
    social_category: Optional[str] = None
    special_category: Optional[str] = None
    business_category: Optional[str] = None
    investment: Optional[float] = None
    location: Optional[str] = None
    education: Optional[str] = None
    experience: Optional[float] = None
    business_description: Optional[str] = None


class Scheme(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: int
    name: str = ""
    description: Optional[str] = None
    business_category: Optional[str] = None
    max_investment: Optional[float] = None
    location: Optional[str] = None
    benefits: Optional[Dict[str, Any]] = None
    rules: Optional[Dict[str, Any]] = None
    beneficiary_categories: Optional[Union[List[str], Dict[str, Any]]] = None
    tier: Literal["eligible", "possibly_eligible"] = "eligible"


class RankRequest(BaseModel):
    profile: Profile
    schemes: List[Scheme] = Field(default_factory=list, max_length=500)


class RankedScheme(BaseModel):
    scheme_id: int
    score: float
    reasons: List[str]


class RankResponse(BaseModel):
    model_version: str
    results: List[RankedScheme]
