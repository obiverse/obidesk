#!/usr/bin/env python3
"""
obiDesk — Business Data Enrichment
Generates taglines, descriptions, services, and hours from category + name heuristics.
No API key needed. Run after collection to make every listing look complete.

Usage:
  python3 scripts/enrich.py                  # Enrich all empty fields
  python3 scripts/enrich.py --force          # Overwrite existing fields too
  python3 scripts/enrich.py --feature 30     # Mark top 30 as featured
"""

import json
import sys
import random
import re

random.seed(42)  # Reproducible but varied

# ── Category Templates ───────────────────────────────────────────────
TEMPLATES = {
    "schools": {
        "taglines": [
            "Building tomorrow's leaders today",
            "Where learning meets excellence",
            "Quality education in a nurturing environment",
            "Empowering young minds for the future",
            "A tradition of academic excellence",
        ],
        "descriptions": [
            "A reputable educational institution in {area} providing quality learning experiences for students. Well-equipped classrooms, experienced teachers, and a supportive environment for academic growth.",
            "Dedicated to raising confident, knowledgeable students through modern teaching methods and a well-structured curriculum. Located in the heart of {area}, Abuja.",
            "Offering comprehensive education with a focus on both academic excellence and character development. Serving families in {area} and surrounding communities.",
        ],
        "services": [
            ["Nursery Education", "Primary Education", "Secondary Education"],
            ["Nursery & Primary", "After-School Programs", "Exam Preparation"],
            ["Primary Education", "Secondary Education", "Extracurricular Activities"],
            ["Early Childhood Education", "Primary School", "Holiday Programs"],
        ],
        "hours": "Mon-Fri 7:30am - 3:30pm",
    },
    "clinics": {
        "taglines": [
            "Your health, our priority",
            "Quality healthcare you can trust",
            "Caring for you and your family",
            "Professional medical care, always available",
            "Affordable healthcare for every family",
        ],
        "descriptions": [
            "A trusted healthcare facility in {area} offering professional medical services. Our team of experienced practitioners provides quality care for individuals and families.",
            "Providing accessible and reliable healthcare services to the {area} community. Clean facility, professional staff, and affordable treatment options.",
            "Dedicated to delivering excellent medical care in {area}. From routine check-ups to specialized treatment, we're here for your health needs.",
        ],
        "services": [
            ["General Consultation", "Laboratory Tests", "Pharmacy"],
            ["Primary Care", "Maternal Health", "Immunization", "Pharmacy"],
            ["Medical Consultation", "Diagnostics", "Prescription Services"],
            ["General Medicine", "Family Health", "Emergency Care", "Pharmacy"],
        ],
        "hours": "Mon-Sat 8:00am - 8:00pm",
    },
    "restaurants": {
        "taglines": [
            "Taste the difference",
            "Good food, great vibes",
            "Where every meal is a celebration",
            "Fresh flavors, warm hospitality",
            "Your favorite food destination",
        ],
        "descriptions": [
            "A popular dining spot in {area} serving delicious meals prepared with fresh, quality ingredients. Comfortable ambiance, friendly service, and a menu that satisfies every appetite.",
            "Bringing you the best of Nigerian and continental cuisine in {area}. Whether dining in or taking away, enjoy fresh meals prepared daily by our skilled kitchen team.",
            "Located in {area}, we offer a variety of tasty dishes at fair prices. Perfect for lunch breaks, family dinners, or when you just want good food delivered fast.",
        ],
        "services": [
            ["Dine-in", "Takeaway", "Delivery", "Catering"],
            ["Nigerian Cuisine", "Continental", "Grills & BBQ", "Drinks"],
            ["Breakfast", "Lunch", "Dinner", "Snacks & Drinks"],
            ["Fast Food", "Local Dishes", "Takeaway", "Event Catering"],
        ],
        "hours": "Mon-Sun 8:00am - 10:00pm",
    },
    "shops": {
        "taglines": [
            "Quality products at fair prices",
            "Everything you need, one place",
            "Shop smart, shop local",
            "Your trusted neighborhood store",
            "Quality goods for every home",
        ],
        "descriptions": [
            "A well-stocked retail outlet in {area} offering a wide range of products for everyday needs. Friendly staff, competitive prices, and convenient location.",
            "Serving the {area} community with quality products and reliable service. From household essentials to specialty items, find what you need at great prices.",
            "Conveniently located in {area}, we stock a variety of goods to meet your daily needs. Visit us for quality products and helpful service.",
        ],
        "services": [
            ["Retail Sales", "Wholesale", "Delivery Available"],
            ["Household Items", "Personal Care", "Groceries"],
            ["Electronics", "Accessories", "Phone Repairs"],
            ["General Merchandise", "Bulk Purchase", "Home Delivery"],
        ],
        "hours": "Mon-Sat 8:00am - 7:00pm",
    },
    "finance": {
        "taglines": [
            "Banking made simple",
            "Your money, your control",
            "Financial solutions for everyone",
            "Trusted by thousands in Abuja",
            "Smart banking for modern Nigeria",
        ],
        "descriptions": [
            "A trusted financial institution serving customers in {area} with a range of banking and financial services. Convenient location, professional staff, and modern facilities.",
            "Providing reliable banking services to individuals and businesses in {area}. Savings, transfers, loans, and more — all under one roof.",
            "Located in {area}, we offer accessible financial services designed for the needs of everyday Nigerians. Visit us or use our digital channels.",
        ],
        "services": [
            ["Savings Accounts", "Current Accounts", "Transfers", "ATM"],
            ["Personal Banking", "Business Accounts", "Loans", "POS Services"],
            ["Account Opening", "Money Transfer", "Bill Payments", "Mobile Banking"],
        ],
        "hours": "Mon-Fri 8:00am - 4:00pm",
    },
    "auto": {
        "taglines": [
            "Your car, our care",
            "Reliable auto services you can trust",
            "Keeping Abuja on the road",
            "Expert mechanics, honest prices",
            "Professional vehicle care",
        ],
        "descriptions": [
            "Professional auto service center in {area} offering quality repairs and maintenance for all vehicle makes and models. Experienced mechanics and fair pricing.",
            "Trusted by drivers across {area} for reliable vehicle repairs, servicing, and maintenance. We get you back on the road quickly and safely.",
            "Conveniently located in {area}, we provide comprehensive auto services from routine maintenance to major repairs. All work guaranteed.",
        ],
        "services": [
            ["Engine Repair", "Brake Service", "Oil Change", "Diagnostics"],
            ["Vehicle Servicing", "AC Repair", "Electrical Work", "Tyre Service"],
            ["Car Wash", "Detailing", "Minor Repairs", "Engine Tune-up"],
            ["Auto Repairs", "Body Work", "Painting", "Maintenance"],
        ],
        "hours": "Mon-Sat 8:00am - 6:00pm",
    },
    "beauty": {
        "taglines": [
            "Where beauty meets elegance",
            "Look good, feel great",
            "Your beauty destination",
            "Style that speaks for you",
            "Beautiful inside and out",
        ],
        "descriptions": [
            "A modern beauty salon in {area} offering professional grooming services for men and women. Skilled stylists, clean environment, and the latest trends.",
            "Step into our salon in {area} and experience top-quality beauty treatments. From haircuts to facials, we help you look and feel your best.",
        ],
        "services": [
            ["Haircuts & Styling", "Braiding", "Manicure & Pedicure", "Facials"],
            ["Hair Treatment", "Coloring", "Makeup", "Bridal Packages"],
            ["Barbing", "Shaving", "Hair Styling", "Nail Care"],
        ],
        "hours": "Mon-Sat 9:00am - 7:00pm",
    },
    "worship": {
        "taglines": [
            "A place of faith and fellowship",
            "Worship in spirit and truth",
            "Come as you are",
            "Growing together in faith",
            "A spiritual home for all",
        ],
        "descriptions": [
            "A welcoming place of worship in {area} where the community gathers for spiritual growth, fellowship, and service. All are welcome.",
            "Serving the spiritual needs of the {area} community through worship, teaching, and community outreach programs.",
        ],
        "services": [
            ["Worship Services", "Bible Study", "Youth Programs", "Community Outreach"],
            ["Prayer Sessions", "Counseling", "Charity Programs", "Fellowship"],
            ["Daily Prayers", "Community Events", "Education Programs"],
        ],
        "hours": "See schedule",
    },
    "real-estate": {
        "taglines": [
            "Find your perfect space",
            "Premium properties in Abuja",
            "Your home, your comfort",
            "Trusted hospitality",
            "Where comfort meets convenience",
        ],
        "descriptions": [
            "Offering quality accommodation and property services in {area}. Whether you need a room for the night, a shortlet for the week, or property guidance, we're here to help.",
            "Located in the heart of {area}, we provide comfortable, secure, and affordable accommodation. Clean rooms, reliable power, and warm hospitality.",
        ],
        "services": [
            ["Room Booking", "Shortlet", "Event Hosting", "Parking"],
            ["Hotel Rooms", "Conference Hall", "Restaurant", "Laundry"],
            ["Property Sales", "Rentals", "Property Management", "Valuation"],
            ["Guest Rooms", "Suites", "Room Service", "Airport Transfer"],
        ],
        "hours": "24 Hours",
    },
    "home-services": {
        "taglines": [
            "Reliable home services you can trust",
            "Your home, our expertise",
            "Professional services at your doorstep",
        ],
        "descriptions": [
            "Providing reliable home services to residents in {area}. Professional, timely, and affordable solutions for your household needs.",
        ],
        "services": [
            ["Plumbing", "Electrical Work", "AC Repair", "Cleaning"],
            ["Generator Servicing", "Painting", "Carpentry", "Pest Control"],
        ],
        "hours": "Mon-Sat 8:00am - 6:00pm",
    },
    "events": {
        "taglines": [
            "Making moments memorable",
            "Events done right",
            "Your celebration, our passion",
        ],
        "descriptions": [
            "Professional event services in {area}. From planning to execution, we make every occasion special.",
        ],
        "services": [
            ["Event Planning", "Decoration", "Catering", "Photography"],
            ["Venue Rental", "Sound & Lighting", "MC Services", "Coordination"],
        ],
        "hours": "Mon-Sat 9:00am - 6:00pm",
    },
    "tech": {
        "taglines": [
            "Technology solutions that work",
            "Smart tech for your business",
            "IT support you can rely on",
        ],
        "descriptions": [
            "Providing technology solutions and IT services in {area}. From computer repairs to business systems, we help you stay connected and productive.",
        ],
        "services": [
            ["Computer Repair", "Networking", "Software Installation", "CCTV"],
            ["Phone Repair", "Web Development", "IT Support", "Data Recovery"],
        ],
        "hours": "Mon-Sat 9:00am - 6:00pm",
    },
    "legal": {
        "taglines": [
            "Expert legal counsel",
            "Your trusted legal partners",
        ],
        "descriptions": [
            "Professional legal and consulting services in {area}. Experienced practitioners providing guidance on business, property, and personal legal matters.",
        ],
        "services": [
            ["Legal Consultation", "Contract Review", "Business Registration", "Dispute Resolution"],
        ],
        "hours": "Mon-Fri 9:00am - 5:00pm",
    },
}

AREA_NAMES = {
    "gwarinpa": "Gwarinpa", "wuse": "Wuse", "wuse2": "Wuse 2", "jabi": "Jabi",
    "maitama": "Maitama", "garki": "Garki", "asokoro": "Asokoro", "kubwa": "Kubwa",
    "lugbe": "Lugbe", "utako": "Utako", "lifecamp": "Life Camp", "central-area": "Central Area",
    "apo": "Apo", "lokogoma": "Lokogoma", "dei-dei": "Dei-Dei", "nyanya": "Nyanya",
    "karu": "Karu", "mpape": "Mpape", "dutse": "Dutse",
}

def enrich_business(biz, force=False):
    """Fill empty fields with intelligent template data."""
    cat = biz["categoryIds"][0] if biz.get("categoryIds") else "shops"
    template = TEMPLATES.get(cat, TEMPLATES["shops"])
    area = AREA_NAMES.get(biz.get("areaId", ""), biz.get("areaId", "Abuja"))
    name = biz.get("name", "Business")

    # Tagline
    if force or not biz.get("tagline"):
        biz["tagline"] = random.choice(template["taglines"])

    # Description
    if force or not biz.get("description"):
        desc = random.choice(template["descriptions"])
        biz["description"] = desc.format(area=area, name=name)

    # Services
    if force or not biz.get("services") or len(biz.get("services", [])) == 0:
        biz["services"] = random.choice(template["services"])

    # Hours
    if force or not biz.get("hours"):
        biz["hours"] = template.get("hours", "Mon-Sat 8:00am - 6:00pm")

    # Tags — ensure area and category are in tags
    if not biz.get("tags"):
        biz["tags"] = []
    area_id = biz.get("areaId", "")
    if area_id and area_id not in biz["tags"]:
        biz["tags"].append(area_id)
    if cat not in biz["tags"]:
        biz["tags"].append(cat)
    # Add name words as tags
    name_words = [w.lower() for w in re.split(r'\W+', name) if len(w) > 2]
    for w in name_words[:3]:
        if w not in biz["tags"]:
            biz["tags"].append(w)

    # Address — make sure it's not empty
    if not biz.get("address") or biz["address"] == f"{area}, Abuja":
        biz["address"] = f"{area}, Abuja"

    return biz

def feature_top_businesses(businesses, count):
    """Mark the best businesses as featured (those with most data)."""
    # Reset all
    for b in businesses:
        b["featured"] = False

    # Score by completeness
    def score(b):
        s = 0
        if b.get("phone"): s += 3
        if b.get("hours") and b["hours"] != "See schedule": s += 1
        if b.get("description"): s += 1
        if b.get("verificationStatus") != "unverified": s += 2
        return s

    ranked = sorted(businesses, key=score, reverse=True)
    for b in ranked[:count]:
        b["featured"] = True

    return businesses

def main():
    force = "--force" in sys.argv
    feature_count = 30

    for i, arg in enumerate(sys.argv):
        if arg == "--feature" and i + 1 < len(sys.argv):
            feature_count = int(sys.argv[i + 1])

    with open("docs/data/businesses.json") as f:
        businesses = json.load(f)

    print(f"Enriching {len(businesses)} businesses...")

    enriched = 0
    for biz in businesses:
        had_desc = bool(biz.get("description"))
        enrich_business(biz, force=force)
        if not had_desc and biz.get("description"):
            enriched += 1

    # Feature top businesses
    businesses = feature_top_businesses(businesses, feature_count)
    featured = sum(1 for b in businesses if b.get("featured"))

    with open("docs/data/businesses.json", "w") as f:
        json.dump(businesses, f, indent=2, ensure_ascii=False)

    print(f"Enriched: {enriched} new descriptions generated")
    print(f"Featured: {featured} businesses marked as featured")

    # Stats
    has_desc = sum(1 for b in businesses if b.get("description"))
    has_svc = sum(1 for b in businesses if b.get("services") and len(b["services"]) > 0)
    has_hours = sum(1 for b in businesses if b.get("hours"))
    has_tag = sum(1 for b in businesses if b.get("tagline"))

    print(f"\nCompleteness:")
    print(f"  Descriptions: {has_desc}/{len(businesses)}")
    print(f"  Taglines: {has_tag}/{len(businesses)}")
    print(f"  Services: {has_svc}/{len(businesses)}")
    print(f"  Hours: {has_hours}/{len(businesses)}")

    import os
    size = os.path.getsize("docs/data/businesses.json")
    print(f"\nFile size: {size/1024:.0f}KB")

if __name__ == "__main__":
    main()
