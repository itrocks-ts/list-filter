import { Director } from './search-director'

export declare class Studio
{
	name: string
}

export declare class Film
{
	added: Date
	director?: Director
	originalTitle: string
	studio: Studio
	title: string
	watchCount?: null | number
}
