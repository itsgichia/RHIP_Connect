from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import email_service
from app.database import get_db
from app.models import InvestorEnquiry, TenantEnquiry
from app.schemas import InvestorEnquiryCreate, MessageResponse, TenantEnquiryCreate

router = APIRouter(prefix="/forms", tags=["forms"])


@router.post("/tenant-enquiry", response_model=MessageResponse)
async def tenant_enquiry(body: TenantEnquiryCreate, db: Session = Depends(get_db)):
    enquiry = TenantEnquiry(
        company_name=body.company_name,
        contact_name=body.contact_name,
        email=body.email,
        phone=body.phone,
        company_type=body.company_type,
        desks_needed=body.desks_needed,
        preferred_start=body.preferred_start,
        message=body.message,
    )
    db.add(enquiry)
    db.commit()
    db.refresh(enquiry)
    await email_service.send_tenant_enquiry_confirmation(enquiry)
    return MessageResponse(
        message="Enquiry received. RHIP will be in touch within 2 business days."
    )


@router.post("/investor-contact", response_model=MessageResponse)
async def investor_contact(body: InvestorEnquiryCreate, db: Session = Depends(get_db)):
    enquiry = InvestorEnquiry(
        name=body.name,
        email=body.email,
        phone=body.phone,
        message=body.message,
    )
    db.add(enquiry)
    db.commit()
    db.refresh(enquiry)
    await email_service.send_investor_enquiry_notification(enquiry)
    return MessageResponse(message="Message received. RHIP will be in touch soon.")
