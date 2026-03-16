/**
 * Auto-generated Static Sources List for scienceDaily
 * Generated on: 2026-03-12T13:11:13.482Z
 */
const scienceDailyStrategy = require('../../strategies/scienceDaily');
const { createStandardConfig } = require('../SourceFactory');

const BASE_URL = "https://www.sciencedaily.com/news";

const CATEGORY_MAP = {
    "Health": [
        {
            "sub": "Allergy",
            "path": "health_medicine/allergy"
        },
        {
            "sub": "Cancer",
            "path": "health_medicine/cancer"
        },
        {
            "sub": "Cold and Flu",
            "path": "health_medicine/cold_and_flu"
        },
        {
            "sub": "Diabetes",
            "path": "health_medicine/diabetes"
        },
        {
            "sub": "Heart Disease",
            "path": "health_medicine/heart_disease"
        },
        {
            "sub": "Mind & Brain",
            "path": "mind_brain"
        },
        {
            "sub": "ADD and ADHD",
            "path": "mind_brain/add_and_adhd"
        },
        {
            "sub": "Alzheimer's",
            "path": "mind_brain/alzheimer's"
        },
        {
            "sub": "Headaches",
            "path": "mind_brain/headaches"
        },
        {
            "sub": "Intelligence",
            "path": "mind_brain/intelligence"
        },
        {
            "sub": "Psychology",
            "path": "mind_brain/psychology"
        },
        {
            "sub": "Living Well",
            "path": "living_well"
        },
        {
            "sub": "Parenting",
            "path": "mind_brain/parenting"
        },
        {
            "sub": "Child Development",
            "path": "mind_brain/child_development"
        },
        {
            "sub": "Stress",
            "path": "mind_brain/stress"
        },
        {
            "sub": "Nutrition",
            "path": "health_medicine/nutrition"
        },
        {
            "sub": "Fitness",
            "path": "health_medicine/fitness"
        }
    ],
    "Tech": [
        {
            "sub": "Matter & Energy",
            "path": "matter_energy"
        },
        {
            "sub": "Chemistry",
            "path": "matter_energy/chemistry"
        },
        {
            "sub": "Fossil Fuels",
            "path": "matter_energy/fossil_fuels"
        },
        {
            "sub": "Nanotechnology",
            "path": "matter_energy/nanotechnology"
        },
        {
            "sub": "Physics",
            "path": "matter_energy/physics"
        },
        {
            "sub": "Solar Energy",
            "path": "matter_energy/solar_energy"
        },
        {
            "sub": "Space & Time",
            "path": "space_time"
        },
        {
            "sub": "Black Holes",
            "path": "space_time/black_holes"
        },
        {
            "sub": "Dark Matter",
            "path": "space_time/dark_matter"
        },
        {
            "sub": "Extrasolar Planets",
            "path": "space_time/extrasolar_planets"
        },
        {
            "sub": "Solar System",
            "path": "space_time/solar_system"
        },
        {
            "sub": "Space Telescopes",
            "path": "space_time/space_telescopes"
        },
        {
            "sub": "Computers & Math",
            "path": "computers_math"
        },
        {
            "sub": "Artificial Intelligence",
            "path": "computers_math/artificial_intelligence"
        },
        {
            "sub": "Mathematics",
            "path": "computers_math/mathematics"
        },
        {
            "sub": "Quantum Computers",
            "path": "computers_math/quantum_computers"
        },
        {
            "sub": "Robotics",
            "path": "computers_math/robotics"
        },
        {
            "sub": "Virtual Reality",
            "path": "computers_math/virtual_reality"
        }
    ],
    "Enviro": [
        {
            "sub": "Plants & Animals",
            "path": "plants_animals"
        },
        {
            "sub": "Agriculture and Food",
            "path": "plants_animals/agriculture_and_food"
        },
        {
            "sub": "Biology",
            "path": "plants_animals/biology"
        },
        {
            "sub": "Biotechnology",
            "path": "plants_animals/biotechnology"
        },
        {
            "sub": "Extinction",
            "path": "plants_animals/extinction"
        },
        {
            "sub": "Microbes and More",
            "path": "plants_animals/microbes_and_more"
        },
        {
            "sub": "Earth & Climate",
            "path": "earth_climate"
        },
        {
            "sub": "Climate",
            "path": "earth_climate/climate"
        },
        {
            "sub": "Earthquakes",
            "path": "earth_climate/earthquakes"
        },
        {
            "sub": "Geology",
            "path": "earth_climate/geology"
        },
        {
            "sub": "Global Warming",
            "path": "earth_climate/global_warming"
        },
        {
            "sub": "Pollution",
            "path": "earth_climate/pollution"
        },
        {
            "sub": "Fossils & Ruins",
            "path": "fossils_ruins"
        },
        {
            "sub": "Anthropology",
            "path": "fossils_ruins/anthropology"
        },
        {
            "sub": "Archaeology",
            "path": "fossils_ruins/archaeology"
        },
        {
            "sub": "Dinosaurs",
            "path": "fossils_ruins/dinosaurs"
        },
        {
            "sub": "Evolution",
            "path": "fossils_ruins/evolution"
        },
        {
            "sub": "Paleontology",
            "path": "fossils_ruins/paleontology"
        }
    ],
    "Society": [
        {
            "sub": "Science & Society",
            "path": "science_society"
        },
        {
            "sub": "Arts & Culture",
            "path": "science_society/arts_and_culture"
        },
        {
            "sub": "Economics",
            "path": "science_society/economics"
        },
        {
            "sub": "Privacy Issues",
            "path": "science_society/privacy_issues"
        },
        {
            "sub": "Public Health",
            "path": "science_society/public_health"
        },
        {
            "sub": "Sports",
            "path": "science_society/sports"
        },
        {
            "sub": "Business & Industry",
            "path": "business_industry"
        },
        {
            "sub": "Computers & Internet",
            "path": "computers_math/computers_and_internet"
        },
        {
            "sub": "Energy & Resources",
            "path": "matter_energy/energy_and_resources"
        },
        {
            "sub": "Engineering",
            "path": "matter_energy/engineering"
        },
        {
            "sub": "Medical Technology",
            "path": "matter_energy/medical_technology"
        },
        {
            "sub": "Transportation",
            "path": "matter_energy/automotive_and_transportation"
        },
        {
            "sub": "Education & Learning",
            "path": "education_learning"
        },
        {
            "sub": "Creativity",
            "path": "mind_brain/creativity"
        },
        {
            "sub": "Educational Psychology",
            "path": "mind_brain/educational_psychology"
        },
        {
            "sub": "Infant & Preschool",
            "path": "mind_brain/infant_and_preschool_learning"
        },
        {
            "sub": "Learning Disorders",
            "path": "mind_brain/learning_disorders"
        },
        {
            "sub": "STEM Education",
            "path": "science_society/stem_education"
        }
    ],
    "Quirky": [
        {
            "sub": "Top News",
            "path": "strange_offbeat"
        },
        {
            "sub": "Human Quirks",
            "path": "strange_offbeat/human_quirks"
        },
        {
            "sub": "Odd Creatures",
            "path": "strange_offbeat/odd_creatures"
        },
        {
            "sub": "Bizarre Things",
            "path": "strange_offbeat/bizarre_things"
        },
        {
            "sub": "Weird World",
            "path": "strange_offbeat/weird_world"
        }
    ]
};

module.exports = createStandardConfig({
    strategy: scienceDailyStrategy,
    categoryMap: CATEGORY_MAP,
    baseUrl: BASE_URL,
    prefix: 'SD'
});
