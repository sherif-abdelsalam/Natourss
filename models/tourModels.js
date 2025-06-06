const mongoose = require('mongoose');
const slugify = require("slugify");
// const User = require("./userModel");
// const validator = require('validator');

const tourSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'A tour must have a name'],
            unique: true,
            trim: true,
            maxlength: [40, 'A tour name must have less or equal then 40 characters'],
            minlength: [10, 'A tour name must have more or equal then 10 characters'],
            // validate: [validator.isAlpha, 'Tour name must only contain characters']
        },
        slug: String,
        duration: {
            type: Number,
            required: [true, 'A tour must have a duration'],
            min: [1, 'Duration must be above 1 day'],
        },
        maxGroupSize: {
            type: Number,
            required: [true, 'A tour must have a group size']
        },
        difficulty: {
            type: String,
            required: [true, 'A tour must have a difficulty'],
            enum: {
                values: ['easy', 'medium', 'difficult'],
                message: 'Difficulty is either: easy, medium, difficult'
            }

        },
        ratingsAverage: {
            type: Number,
            default: 4.5,
            min: [1, 'Rating must be above 1.0'],
            max: [5, 'Rating must be below 5.0']
        },
        ratingsQuantity: {
            type: Number,
            default: 0
        },
        price: {
            type: Number,
            required: [true, 'A tour must have a price'],
            min: [0, 'Price must be above 0'],
        },
        priceDiscount: {
            type: Number,
            validate: {
                // This only works on CREATE and SAVE!!!
                validator: function (val) {
                    return val < this.price;
                },
                message: 'Discount price ({VALUE}) should be below regular price'
            }
        },
        summary: {
            type: String,
            trim: true,
            required: [true, 'A tour must have a description']
        },
        description: {
            type: String,
            trim: true
        },
        imageCover: {
            type: String,
            required: [true, 'A tour must have a cover image']
        },
        images: [String],
        createdAt: {
            type: Date,
            default: Date.now(),
            select: false
        },
        startDates: [Date],
        isSecret: Boolean,
        startLocation: {
            type: {
                type: String,
                default: "Point",
                enum: ["Point"]
            },
            coordinates: [Number],
            address: String,
            description: String,
        },
        locations: [
            {
                type: {
                    type: String,
                    default: "Point",
                    enum: ["Point"]
                },
                coordinates: [Number],
                address: String,
                description: String,
                day: Number
            }
        ],
        guides: [
            {
                type: mongoose.Schema.ObjectId,
                ref: 'User'
            }
        ]

    },
    {
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);



tourSchema.virtual("durationWeeks").get(function () {
    return this.duration / 7;
});


tourSchema.virtual('reviews', {
    ref: 'Review',
    localField: '_id',
    foreignField: 'tour',
});

tourSchema.pre("save", function (next) {
    this.slug = slugify(this.name, { lower: true })
    next();
})

// tourSchema.pre("save", function (next) {
//     const guidesPromises = this.guides.map(async id => await User.findById(id));
//     this.guides = Promise.all(guidesPromises);
//     next();
// });

// tourSchema.post("save", function (doc, next) {
//     console.log(doc)
//     next();
// });

tourSchema.pre(/^find/, function (next) {
    this.find({ isSecret: { $ne: true } });
    // this.start = Date.now();
    next();
});

tourSchema.pre(/^find/, function (next) {
    this.populate({
        path: 'guides',
        select: '-__v -passwordChangedAt'
    });
    next();
});

tourSchema.post(/^find/, function (docs, next) {
    // console.log(Date.now() - this.start);
    next();
});


tourSchema.pre("aggregate", function (next) {
    this.pipeline().unshift({
        $match: {
            isSecret: { $ne: true }
        }
    });
    console.log(this.pipeline())
    next();
});

const Tour = mongoose.model('Tour', tourSchema);
module.exports = Tour;
