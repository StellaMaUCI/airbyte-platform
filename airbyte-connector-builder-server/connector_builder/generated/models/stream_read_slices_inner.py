# coding: utf-8

from __future__ import annotations
from datetime import date, datetime  # noqa: F401

import re  # noqa: F401
from typing import Any, Dict, List, Optional  # noqa: F401

from pydantic import AnyUrl, BaseModel, EmailStr, Field, validator  # noqa: F401
from connector_builder.generated.models.stream_read_slices_inner_pages_inner import StreamReadSlicesInnerPagesInner
from connector_builder.generated.models.stream_read_slices_inner_slice_descriptor import StreamReadSlicesInnerSliceDescriptor


class StreamReadSlicesInner(BaseModel):
    """NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).

    Do not edit the class manually.

    StreamReadSlicesInner - a model defined in OpenAPI

        pages: The pages of this StreamReadSlicesInner.
        slice_descriptor: The slice_descriptor of this StreamReadSlicesInner [Optional].
        state: The state of this StreamReadSlicesInner [Optional].
    """

    pages: List[StreamReadSlicesInnerPagesInner] = Field(alias="pages")
    slice_descriptor: Optional[StreamReadSlicesInnerSliceDescriptor] = Field(alias="slice_descriptor", default=None)
    state: Optional[Dict[str, Any]] = Field(alias="state", default=None)

StreamReadSlicesInner.update_forward_refs()
